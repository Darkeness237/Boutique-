-- Cameroun :
-- 1. Les marchandises exportées hors UE ne supportent pas la TVA française : la valeur de base est
--    le prix France hors TVA (interrupteur goods_without_fr_vat, à faire confirmer : voir docs/cameroun.md).
-- 2. Plus aucune exclusion automatique : tous les produits ont un prix livré, le tri se fera avec
--    le transitaire (les fauteuils reçoivent un poids d'expédition).

alter table private.cm_params add column goods_without_fr_vat boolean not null default true;

insert into private.cm_weights (category_slug, subcategory, kg) values ('fauteuils', '', 25)
on conflict (category_slug, subcategory) do update set kg = excluded.kg;

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
          -- Valeur CAF : marchandise + fret + assurance, puis droits et taxes, puis TVA camerounaise.
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
           -- Prix France hors TVA française (export hors UE) ou TTC selon le réglage.
           p2.price_cents / 100.0 / case when c.goods_without_fr_vat then 1.2 else 1 end as goods,
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

select private.compute_cm_prices();
