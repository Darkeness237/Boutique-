-- Recalcul du catalogue en différé.
-- Avec deux fournisseurs et le moteur de pricing, le recalcul complet dépasse le temps maximal d'une requête
-- d'API. L'import enregistre donc une demande de recalcul, exécutée dans la minute par une tâche planifiée de la
-- base (sans limite de durée). Le script peut être relancé.

create table if not exists private.refresh_requests (
  id boolean primary key default true check (id),
  requested_at timestamptz not null default now()
);

create or replace function public.import_finish(p_token text, p_run_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.import_runs;
  v_quarantined integer;
begin
  perform private.assert_import_token(p_token);
  select * into v_run from public.import_runs where id = p_run_id and finished_at is null;
  if v_run.id is null then
    raise exception 'import inconnu ou terminé';
  end if;

  -- Absent du dernier fichier = plus disponible chez ce fournisseur.
  update public.supplier_offers set in_stock = false, updated_at = now()
  where supplier_id = v_run.supplier_id and seen_at < v_run.started_at and in_stock;

  select count(*) into v_quarantined from public.supplier_offers
  where supplier_id = v_run.supplier_id and status = 'quarantine';

  insert into private.refresh_requests (id, requested_at) values (true, now())
  on conflict (id) do update set requested_at = now();

  update public.import_runs
  set finished_at = now(), rows_quarantined = v_quarantined
  where id = p_run_id;

  return jsonb_build_object(
    'offres_en_quarantaine', v_quarantined,
    'recalcul', 'programmé dans la minute'
  );
end;
$$;

create or replace function private.refresh_if_requested()
returns integer language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from private.refresh_requests) then
    return 0;
  end if;
  delete from private.refresh_requests;
  return private.refresh_products();
end;
$$;
revoke execute on function private.refresh_if_requested() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'vetex-refresh';
select cron.schedule('vetex-refresh', '* * * * *', 'select private.refresh_if_requested()');

-- EAN-13 : les codes à 11 ou 12 chiffres sont complétés par des zéros (même règle que le script d'import),
-- pour qu'un même produit soit reconnu chez tous les fournisseurs.
update public.supplier_offers set ean = lpad(ean, 13, '0') where length(ean) in (11, 12);
update public.products p set ean = lpad(p.ean, 13, '0')
where length(p.ean) in (11, 12)
  and not exists (select 1 from public.products q where q.ean = lpad(p.ean, 13, '0'));

insert into private.refresh_requests default values on conflict (id) do update set requested_at = now();
