-- Les fournisseurs rangent les supports, rallonges et câbles avec les cartes graphiques ou les processeurs.
-- On les déplace dans « Accessoires » pour que chaque rayon ne montre que de vraies pièces.
insert into public.categories (slug, name, hint, sort, margin_pct, min_margin_cents) values
  ('accessoires', 'Accessoires', 'Supports, câbles et petites pièces de montage.', 12, 30, 300)
on conflict (slug) do nothing;

create or replace function private.classify(p_category text, p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_category = 'cartes-graphiques'
         and p_name !~* '(geforce|radeon|quadro|\mrtx\M|\mgtx\M|\marc [ab]\d|\mrx ?\d{3,4}|\mgt ?\d{3,4})'
      then 'accessoires'
    when p_category = 'cartes-graphiques' and p_name ~* '(support|bracket|riser|rallonge|câble|cable|backplate|waterblock)'
      then 'accessoires'
    when p_category = 'processeurs' and p_name !~* '(ryzen|athlon|threadripper|epyc|core|xeon|pentium|celeron)'
      then 'accessoires'
    else p_category
  end;
$$;
revoke execute on function private.classify(text, text) from public, anon, authenticated;

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
    select o.supplier_id, o.supplier_sku, o.ean, o.name, o.brand, o.cost_cents, o.in_stock,
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

select private.refresh_products();
