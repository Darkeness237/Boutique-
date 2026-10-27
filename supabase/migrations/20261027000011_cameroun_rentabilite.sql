-- Un produit dont le fret aérien dépasse la moitié de sa valeur n'est pas proposé au Cameroun
-- (boîtiers, grands écrans…) : il reviendrait 3 à 4 fois son prix. À rouvrir avec un tarif maritime.
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
    price_xaf = case when x.kg is null or x.freight > x.goods * 0.5 then null else
      (ceil(
        (
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
create index if not exists products_cm_idx on public.products (category_slug, price_xaf) where active and price_xaf is not null;
select private.compute_cm_prices();
