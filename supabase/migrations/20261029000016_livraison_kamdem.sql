-- Livraison à domicile au Cameroun : grille de KAMDEM Delivery (partenaire, octobre 2026).
-- Facturation par colis : 1 500 FCFA jusqu'à 5 kg, 1 700 FCFA jusqu'à 10 kg ; au-delà, au volume
-- (2 500 FCFA le premier m³, +1 000 FCFA par m³ supplémentaire). Un colis de composants PC fait bien
-- moins d'un m³ : au-delà de 10 kg on retient donc 2 500 FCFA (à revoir pour les grosses commandes).

-- Poids d'expédition de chaque produit (emballage compris), public : le panier additionne les poids.
alter table public.products add column cm_kg numeric(5,2);
grant select (cm_kg) on public.products to anon, authenticated;

create table public.cm_lastmile_rates (
  carrier text not null,
  max_kg numeric(6,2),            -- null : tranche « au-delà », facturée au volume (1 m³)
  fee_xaf integer not null check (fee_xaf >= 0),
  primary key (carrier, fee_xaf)
);
alter table public.cm_lastmile_rates enable row level security;
grant select on public.cm_lastmile_rates to anon, authenticated;
create policy "tarifs de livraison lisibles" on public.cm_lastmile_rates for select to anon, authenticated using (true);
insert into public.cm_lastmile_rates (carrier, max_kg, fee_xaf) values
  ('KAMDEM Delivery', 5, 1500),
  ('KAMDEM Delivery', 10, 1700),
  ('KAMDEM Delivery', null, 2500);

-- Le tarif ne dépend plus de la ville : fee_xaf devient un supplément éventuel par zone.
comment on column public.cm_delivery_zones.fee_xaf is 'Supplément par ville en plus de la grille au poids (0 par défaut)';
update public.cm_delivery_zones set fee_xaf = 0;

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
          (x.goods + x.freight + x.goods * c.insurance_pct / 100)
            * (1 + (c.duty_pct + c.other_taxes_pct) / 100)
            * (1 + c.vat_pct / 100)
          + c.clearance_eur_per_item
        ) * (1 + c.risk_pct / 100) * c.eur_to_xaf / c.round_to_xaf
      ) * c.round_to_xaf)::integer end,
    cm_kg = x.kg,
    cm_days_min = p.lead_days + c.transit_days_min,
    cm_days_max = p.lead_days + c.transit_days_max
  from (
    select p2.id,
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
