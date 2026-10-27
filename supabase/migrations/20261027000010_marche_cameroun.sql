-- Marché Cameroun : prix en FCFA « tout compris livré » (transport, assurance, droits de douane,
-- taxes, TVA camerounaise). La livraison à domicile est ajoutée au panier selon la ville.
--
-- Les valeurs marquées « À CONFIRMER » sont provisoires : à remplacer par les tarifs réels du
-- transitaire (Paris → Douala) et du livreur local, puis lancer `select private.compute_cm_prices();`.

-- Paramètres (privés : ce sont des coûts) ------------------------------------------------
create table private.cm_params (
  id boolean primary key default true check (id),
  -- Parité fixe garantie par le Trésor français : 1 € = 655,957 FCFA.
  eur_to_xaf numeric(10,3) not null default 655.957,
  freight_eur_per_kg numeric(6,2) not null default 9.00,        -- À CONFIRMER : tarif du transitaire
  handling_eur_per_item numeric(6,2) not null default 3.00,     -- À CONFIRMER : préparation, emballage renforcé
  insurance_pct numeric(5,2) not null default 1.00,             -- À CONFIRMER : assurance transport
  duty_pct numeric(5,2) not null default 10.00,                 -- TEC CEMAC, biens d'équipement (à vérifier par code SH)
  other_taxes_pct numeric(5,2) not null default 2.50,           -- TCI 1 %, redevance informatique, autres prélèvements
  vat_pct numeric(5,2) not null default 19.25,                  -- TVA Cameroun, centimes additionnels inclus
  clearance_eur_per_item numeric(6,2) not null default 4.00,    -- À CONFIRMER : honoraires de dédouanement
  risk_pct numeric(5,2) not null default 3.00,                  -- marge de sécurité (écarts de taxation, casse)
  round_to_xaf integer not null default 500,
  transit_days_min smallint not null default 10,                -- À CONFIRMER
  transit_days_max smallint not null default 21                 -- À CONFIRMER
);
insert into private.cm_params default values;

-- Poids d'expédition par type de produit (kg, emballage et volume compris).
create table private.cm_weights (
  category_slug text not null,
  subcategory text not null default '',
  kg numeric(5,2) not null check (kg > 0),
  primary key (category_slug, subcategory)
);
insert into private.cm_weights (category_slug, subcategory, kg) values
  ('processeurs', '', 0.5),
  ('cartes-meres', '', 1.8),
  ('cartes-graphiques', '', 2.5),
  ('memoire', '', 0.3),
  ('stockage', '', 0.3), ('stockage', 'disques-durs', 0.8), ('stockage', 'cles-usb', 0.1), ('stockage', 'cartes-memoire', 0.1),
  ('alimentations', '', 3.0),
  ('boitiers', '', 11), ('boitiers', 'mini-tour', 7), ('boitiers', 'grand-tour', 16),
  ('refroidissement', '', 0.6), ('refroidissement', 'ventirads', 1.2), ('refroidissement', 'watercooling', 2.5),
  ('refroidissement', 'pates-accessoires', 0.2),
  ('ecrans', '', 8), ('ecrans', '27-et-plus', 10), ('ecrans', 'incurves', 12), ('ecrans', 'portables', 2),
  ('ecrans', 'supports', 5),
  ('peripheriques', '', 0.8), ('peripheriques', 'souris', 0.4), ('peripheriques', 'claviers', 1.5),
  ('peripheriques', 'casques', 1.0), ('peripheriques', 'packs', 2.0), ('peripheriques', 'tapis', 0.6),
  ('peripheriques', 'manettes', 1.5),
  ('accessoires', '', 0.3);
-- Les fauteuils (25 kg et plus en volume) ne sont pas proposés au Cameroun en fret aérien.

-- Zones de livraison à domicile (publiques : le client voit le tarif de sa ville).
create table public.cm_delivery_zones (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  city text not null,
  fee_xaf integer not null check (fee_xaf >= 0),
  days_min smallint not null default 1,
  days_max smallint not null default 3,
  sort smallint not null default 0,
  active boolean not null default true
);
alter table public.cm_delivery_zones enable row level security;
grant select on public.cm_delivery_zones to anon, authenticated;
create policy "zones actives lisibles" on public.cm_delivery_zones for select to anon, authenticated using (active);
insert into public.cm_delivery_zones (slug, city, fee_xaf, days_min, days_max, sort) values
  ('douala', 'Douala', 2000, 1, 2, 1),      -- À CONFIRMER avec le livreur
  ('yaounde', 'Yaoundé', 3500, 1, 3, 2);    -- À CONFIRMER avec le livreur

-- Prix FCFA des produits ------------------------------------------------------------------
alter table public.products add column price_xaf integer, add column cm_days_min smallint, add column cm_days_max smallint;
grant select (price_xaf, cm_days_min, cm_days_max) on public.products to anon, authenticated;

create or replace function private.compute_cm_prices()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
  c private.cm_params;
begin
  select * into c from private.cm_params;
  update public.products p set
    price_xaf = case when x.kg is null then null else
      (ceil(
        (
          -- Valeur CAF : marchandise + fret + assurance, puis droits et taxes, puis TVA.
          (x.goods + x.freight + x.goods * c.insurance_pct / 100)
            * (1 + (c.duty_pct + c.other_taxes_pct) / 100)
            * (1 + c.vat_pct / 100)
          + c.clearance_eur_per_item
        ) * (1 + c.risk_pct / 100) * c.eur_to_xaf / c.round_to_xaf
      ) * c.round_to_xaf)::integer end,
    cm_days_min = p.lead_days + c.transit_days_min,
    cm_days_max = p.lead_days + c.transit_days_max
  from (
    select p2.id,
           p2.price_cents / 100.0 as goods,
           w.kg,
           w.kg * c.freight_eur_per_kg + c.handling_eur_per_item as freight
    from public.products p2
    left join lateral (
      select kg from private.cm_weights cw
      where cw.category_slug = p2.category_slug and cw.subcategory in (coalesce(p2.subcategory, ''), '')
      order by (cw.subcategory = '') asc
      limit 1
    ) w on true
    where p2.active
  ) x
  where p.id = x.id;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function private.compute_cm_prices() from public, anon, authenticated;

select private.compute_cm_prices();

-- Chaque recalcul du catalogue met aussi à jour les prix FCFA.
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
    select o.supplier_id, o.supplier_sku, o.ean, o.name, o.brand, o.family, o.cost_cents, o.in_stock,
           private.classify(f.category_slug, o.name) as category_slug, s.lead_days, s.reliability,
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
           greatest(b.cost_ttc * (1 + c.margin_pct / 100), b.cost_ttc + c.min_margin_cents) as floor_price,
           -- Plancher absolu (coût + marge minimale) : aucune promotion ne descend en dessous.
           (ceil((b.cost_ttc + c.min_margin_cents - 90) / 100.0) * 100 + 90)::integer as promo_floor
    from best b join public.categories c on c.slug = b.category_slug
  )
  insert into public.products as p
    (ean, slug, name, brand, category_slug, subcategory, price_cents, floor_cents, in_stock, lead_days,
     socket, memory, psu_watts, active, updated_at)
  select ean,
         private.slugify(name) || '-' || left(md5(ean), 6),
         name, brand, category_slug,
         private.subclassify(category_slug, family, name,
           case when category_slug = 'alimentations' then ((regexp_match(name, '(\d{3,4}) ?W'))[1])::integer end),
         -- Prix psychologique en ,90 et jamais sous le prix plancher.
         (ceil((floor_price - 90) / 100.0) * 100 + 90)::integer,
         promo_floor,
         in_stock, lead_days,
         case when category_slug in ('processeurs', 'cartes-meres')
              then replace((regexp_match(name, '(AM5|AM4|LGA ?1851|LGA ?1700)'))[1], ' ', '') end,
         case when category_slug in ('memoire', 'cartes-meres')
              then coalesce(
                (regexp_match(name, '(DDR5|DDR4)'))[1],
                -- Ces plateformes n'acceptent qu'un seul type de mémoire.
                case when category_slug = 'cartes-meres' then
                  case when name ~ '(AM5|LGA ?1851)' then 'DDR5' when name ~ 'AM4' then 'DDR4' end
                end) end,
         case when category_slug = 'alimentations'
              then ((regexp_match(name, '(\d{3,4}) ?W'))[1])::integer end,
         true, now()
  from priced
  on conflict (ean) do update set
    name = excluded.name,
    brand = excluded.brand,
    category_slug = excluded.category_slug,
    subcategory = excluded.subcategory,
    price_cents = excluded.price_cents,
    floor_cents = excluded.floor_cents,
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
  perform private.apply_promotions();
  perform private.compute_cm_prices();
  return n;
end;
$$;
