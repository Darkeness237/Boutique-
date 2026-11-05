-- Gestion des commandes dans l'administration : liste, détail (adresse, lignes, fournisseur, marge) et suivi
-- (référence de la commande fournisseur, transporteur, numéro de suivi, note interne).
-- Les colonnes restent fermées aux comptes clients : l'accès passe par des fonctions réservées aux admins.
-- Le script peut être relancé.

alter table public.orders add column if not exists supplier_order_ref text check (length(supplier_order_ref) <= 120);
alter table public.orders add column if not exists carrier text check (length(carrier) <= 60);
alter table public.orders add column if not exists admin_note text check (length(admin_note) <= 2000);
alter table public.orders add column if not exists status_changed_at timestamptz;
alter table public.orders add column if not exists admin_seen_at timestamptz;

-- Liste (200 dernières, filtrable par statut).
create or replace function public.admin_orders(p_status text default null)
returns table(id uuid, number text, created_at timestamptz, status text, market text, currency text, total integer,
              customer_name text, email text, items integer, cost integer, seen boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'accès réservé'; end if;
  return query
    select o.id, o.number, o.created_at, o.status, o.market, o.currency, o.total, o.customer_name, o.email,
           coalesce(sum(i.qty), 0)::integer,
           coalesce(sum(i.qty * i.supplier_cost_cents), 0)::integer,
           o.admin_seen_at is not null
    from public.orders o
    left join public.order_items i on i.order_id = o.id
    where p_status is null or o.status = p_status
    group by o.id
    order by o.created_at desc
    limit 200;
end;
$$;

-- Détail complet d'une commande ; l'ouvrir la marque comme vue.
create or replace function public.admin_order(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
begin
  if not public.is_admin() then raise exception 'accès réservé'; end if;
  update public.orders set admin_seen_at = coalesce(admin_seen_at, now()) where id = p_id;
  select to_jsonb(o) - 'stripe_session_id' || jsonb_build_object(
           'lines', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'product_id', i.product_id, 'name', i.name, 'ean', i.ean, 'qty', i.qty, 'unit_price', i.unit_price,
                      'supplier_id', i.supplier_id, 'supplier_name', s.name, 'supplier_sku', i.supplier_sku,
                      'supplier_cost_cents', i.supplier_cost_cents, 'slug', p.slug) order by i.name)
             from public.order_items i
             left join public.suppliers s on s.id = i.supplier_id
             left join public.products p on p.id = i.product_id
             where i.order_id = o.id), '[]'::jsonb))
    into r
  from public.orders o where o.id = p_id;
  return r;
end;
$$;

-- Mise à jour du suivi par l'admin. Les transitions incohérentes sont refusées.
create or replace function public.admin_order_update(p_id uuid, p_status text, p_supplier_ref text, p_carrier text,
                                                     p_tracking text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  cur text;
begin
  if not public.is_admin() then raise exception 'accès réservé'; end if;
  select status into cur from public.orders where id = p_id for update;
  if cur is null then raise exception 'commande introuvable'; end if;
  if p_status not in ('payee', 'commandee_fournisseur', 'expediee', 'livree', 'annulee', 'remboursee') then
    raise exception 'statut inconnu';
  end if;
  if p_status = 'expediee' and nullif(btrim(p_tracking), '') is null then
    raise exception 'numéro de suivi requis pour passer la commande en « expédiée »';
  end if;
  update public.orders set
    status = p_status,
    status_changed_at = case when p_status <> cur then now() else status_changed_at end,
    supplier_order_ref = nullif(btrim(p_supplier_ref), ''),
    carrier = nullif(btrim(p_carrier), ''),
    tracking = nullif(btrim(p_tracking), ''),
    admin_note = nullif(btrim(p_note), '')
  where id = p_id;
end;
$$;

-- Compteur pour le menu : commandes payées pas encore passées chez le fournisseur.
create or replace function public.admin_orders_to_handle()
returns integer language sql stable security definer set search_path = '' as $$
  select case when public.is_admin() then (select count(*)::integer from public.orders where status = 'payee') else 0 end;
$$;

revoke all on function public.admin_orders(text) from public, anon;
revoke all on function public.admin_order(uuid) from public, anon;
revoke all on function public.admin_order_update(uuid, text, text, text, text, text) from public, anon;
revoke all on function public.admin_orders_to_handle() from public, anon;
grant execute on function public.admin_orders(text) to authenticated;
grant execute on function public.admin_order(uuid) to authenticated;
grant execute on function public.admin_order_update(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.admin_orders_to_handle() to authenticated;
