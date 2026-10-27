-- Le calcul du catalogue range chaque produit dans sa sous-catégorie, retient son prix plancher
-- et applique les promotions en cours. Les promotions sont réévaluées toutes les heures.
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
  return n;
end;
$$;

-- Offres de lancement : uniquement sur les rayons à marge confortable (voir docs/strategie-prix.md).
insert into public.promotions (label, category_slug, discount_pct, ends_at) values
  ('Offre de lancement', 'refroidissement', 10, '2026-11-30 23:59:59+01'),
  ('Offre de lancement', 'boitiers', 8, '2026-11-30 23:59:59+01'),
  ('Semaine des périphériques', 'peripheriques', 12, '2026-11-09 23:59:59+01');

select private.refresh_products();

create extension if not exists pg_cron;
select cron.schedule('silicium-promotions', '5 * * * *', 'select private.apply_promotions()');
