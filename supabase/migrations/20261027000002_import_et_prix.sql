create extension if not exists unaccent with schema extensions;

-- Catégories et marges (stratégie détaillée dans docs/strategie-prix.md).
insert into public.categories (slug, name, hint, sort, margin_pct, min_margin_cents) values
  ('processeurs', 'Processeurs', 'Le socket décide de la carte mère.', 1, 6, 1200),
  ('cartes-meres', 'Cartes mères', 'Socket, format et type de mémoire.', 2, 10, 800),
  ('cartes-graphiques', 'Cartes graphiques', 'Ce qui fait les images par seconde.', 3, 6, 1500),
  ('memoire', 'Mémoire', '32 Go en DDR5 suffisent pour jouer.', 4, 10, 600),
  ('stockage', 'Stockage', 'SSD NVMe pour des chargements courts.', 5, 10, 500),
  ('alimentations', 'Alimentations', 'Prévoir une marge de 30 % sur la conso.', 6, 12, 600),
  ('boitiers', 'Boîtiers', 'Flux d''air, format, longueur de carte graphique.', 7, 18, 600),
  ('refroidissement', 'Refroidissement', 'Ventirad, watercooling AIO et ventilateurs.', 8, 20, 400),
  ('ecrans', 'Écrans', 'Taille, définition et fréquence de rafraîchissement.', 9, 10, 1000),
  ('peripheriques', 'Périphériques', 'Souris, claviers, casques, tapis.', 10, 25, 400),
  ('fauteuils', 'Fauteuils', 'Pour les longues sessions.', 11, 15, 1500);

insert into public.suppliers (id, name, prices_include_vat, lead_days) values
  ('1fotrade', '1foTrade', false, 2);

insert into public.supplier_families (supplier_id, family, category_slug) values
  ('1fotrade', 'Processeur', 'processeurs'),
  ('1fotrade', 'Carte Mère', 'cartes-meres'),
  ('1fotrade', 'Carte Graphique', 'cartes-graphiques'),
  ('1fotrade', 'Mémoire RAM', 'memoire'),
  ('1fotrade', 'Stockage', 'stockage'),
  ('1fotrade', 'Alimentation PC', 'alimentations'),
  ('1fotrade', 'Boîtier PC', 'boitiers'),
  ('1fotrade', 'Watercooling', 'refroidissement'),
  ('1fotrade', 'Ventilateur pour Processeur', 'refroidissement'),
  ('1fotrade', 'Ventilateur de Boîtier', 'refroidissement'),
  ('1fotrade', 'Autres Eléments de Refroidissement', 'refroidissement'),
  ('1fotrade', 'Écran', 'ecrans'),
  ('1fotrade', 'Souris', 'peripheriques'),
  ('1fotrade', 'Clavier', 'peripheriques'),
  ('1fotrade', 'Casque', 'peripheriques'),
  ('1fotrade', 'Tapis de Souris', 'peripheriques'),
  ('1fotrade', 'Pack Clavier - Souris', 'peripheriques'),
  ('1fotrade', 'Périphérique de Jeu', 'peripheriques'),
  ('1fotrade', 'Fauteuil', 'fauteuils');

-- Vérifie un jeton d'import (on ne compare que des empreintes SHA-256).
create or replace function private.assert_import_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null or length(p_token) < 32 or not exists (
    select 1 from private.import_tokens
    where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  ) then
    raise exception 'jeton d''import invalide' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.slugify(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent(p)), '[^a-z0-9]+', '-', 'g'));
$$;

-- Recalcule le catalogue public à partir des offres : meilleure offre par EAN, puis prix de vente.
create or replace function private.refresh_products()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  with offers as (
    select o.*, f.category_slug, s.lead_days, s.reliability,
           round(o.cost_cents * case when s.prices_include_vat then 1 else 1.2 end)::integer as cost_ttc
    from public.supplier_offers o
    join public.suppliers s on s.id = o.supplier_id and s.active
    join public.supplier_families f on f.supplier_id = o.supplier_id and f.family = o.family
    where o.status = 'ok' and o.ean is not null
  ),
  best as (
    select distinct on (ean) *
    from offers
    -- En stock d'abord, puis coût pondéré par la fiabilité, puis délai.
    order by ean, in_stock desc, cost_ttc / reliability asc, lead_days asc
  ),
  priced as (
    select b.*,
           greatest(b.cost_ttc * (1 + c.margin_pct / 100), b.cost_ttc + c.min_margin_cents) as floor_price
    from best b join public.categories c on c.slug = b.category_slug
  )
  insert into public.products as p
    (ean, slug, name, brand, category_slug, price_cents, in_stock, lead_days, socket, memory, psu_watts, active, updated_at)
  select ean,
         private.slugify(name) || '-' || left(md5(ean), 6),
         name, brand, category_slug,
         -- Prix psychologique en ,90 et jamais sous le prix plancher.
         (ceil((floor_price - 90) / 100.0) * 100 + 90)::integer,
         in_stock, lead_days,
         case when category_slug in ('processeurs', 'cartes-meres')
              then replace((regexp_match(name, '(AM5|AM4|LGA ?1851|LGA ?1700)'))[1], ' ', '') end,
         case when category_slug in ('memoire', 'cartes-meres')
              then (regexp_match(name, '(DDR5|DDR4)'))[1] end,
         case when category_slug = 'alimentations'
              then ((regexp_match(name, '(\d{3,4}) ?W'))[1])::integer end,
         true, now()
  from priced
  on conflict (ean) do update set
    name = excluded.name,
    brand = excluded.brand,
    category_slug = excluded.category_slug,
    price_cents = excluded.price_cents,
    in_stock = excluded.in_stock,
    lead_days = excluded.lead_days,
    socket = excluded.socket,
    memory = excluded.memory,
    psu_watts = excluded.psu_watts,
    active = true,
    updated_at = now();
  get diagnostics n = row_count;

  -- Plus aucune offre valable : le produit disparaît du site (sans être supprimé).
  update public.products p set active = false, updated_at = now()
  where p.active and not exists (
    select 1 from public.supplier_offers o
    join public.supplier_families f on f.supplier_id = o.supplier_id and f.family = o.family
    join public.suppliers s on s.id = o.supplier_id and s.active
    where o.ean = p.ean and o.status = 'ok'
  );
  return n;
end;
$$;

-- API d'import (appelée par scripts/import-fournisseur.mjs) ------------------

create or replace function public.import_start(p_token text, p_supplier_id text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_id bigint;
begin
  perform private.assert_import_token(p_token);
  insert into public.import_runs (supplier_id) values (p_supplier_id) returning id into run_id;
  return run_id;
end;
$$;

create or replace function public.import_offers(p_token text, p_run_id bigint, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supplier text;
  n integer;
begin
  perform private.assert_import_token(p_token);
  select supplier_id into v_supplier from public.import_runs where id = p_run_id and finished_at is null;
  if v_supplier is null then
    raise exception 'import inconnu ou terminé';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then
    raise exception 'lot invalide (2000 lignes maximum)';
  end if;

  with incoming as (
    select * from jsonb_to_recordset(p_rows) as r(
      sku text, ean text, mpn text, family text, name text, brand text,
      cost_cents integer, in_stock boolean, quarantine_reason text)
  )
  insert into public.supplier_offers as o
    (supplier_id, supplier_sku, ean, mpn, family, name, brand, cost_cents, in_stock,
     status, quarantine_reason, seen_at, updated_at)
  select v_supplier, sku, nullif(ean, ''), nullif(mpn, ''), family, name, coalesce(brand, ''),
         cost_cents, in_stock,
         case when quarantine_reason is null then 'ok' else 'quarantine' end,
         quarantine_reason, now(), now()
  from incoming
  on conflict (supplier_id, supplier_sku) do update set
    ean = excluded.ean,
    mpn = excluded.mpn,
    family = excluded.family,
    name = excluded.name,
    brand = excluded.brand,
    previous_cost_cents = o.cost_cents,
    cost_cents = excluded.cost_cents,
    in_stock = excluded.in_stock,
    -- Variation brutale par rapport à l'import précédent : on bloque, quelqu'un doit vérifier.
    status = case
      when excluded.status = 'quarantine' then 'quarantine'
      when excluded.cost_cents < o.cost_cents * 0.5 or excluded.cost_cents > o.cost_cents * 2 then 'quarantine'
      else 'ok' end,
    quarantine_reason = case
      when excluded.status = 'quarantine' then excluded.quarantine_reason
      when excluded.cost_cents < o.cost_cents * 0.5 or excluded.cost_cents > o.cost_cents * 2
        then 'variation de prix > x2 depuis le dernier import'
      end,
    seen_at = now(),
    updated_at = now();
  get diagnostics n = row_count;

  update public.import_runs set rows_received = rows_received + n where id = p_run_id;
  return n;
end;
$$;

create or replace function public.import_finish(p_token text, p_run_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.import_runs;
  v_products integer;
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

  v_products := private.refresh_products();

  update public.import_runs
  set finished_at = now(), rows_quarantined = v_quarantined
  where id = p_run_id;

  return jsonb_build_object(
    'produits_publies', v_products,
    'offres_en_quarantaine', v_quarantined
  );
end;
$$;

revoke execute on function private.assert_import_token(text), private.refresh_products(), private.slugify(text)
  from public, anon, authenticated;
-- Les fonctions d'import sont appelables avec la clé publique, mais refusent tout appel sans jeton valide.
revoke execute on function public.import_start(text, text), public.import_offers(text, bigint, jsonb),
  public.import_finish(text, bigint) from public;
grant execute on function public.import_start(text, text), public.import_offers(text, bigint, jsonb),
  public.import_finish(text, bigint) to anon, authenticated;
