-- Livraison à domicile au Cameroun : grille de KAMDEM Delivery (partenaire, octobre 2026), avec marge.
--
-- Coût KAMDEM (par colis) : 1 500 FCFA jusqu'à 5 kg, 1 700 FCFA jusqu'à 10 kg ; au-delà, au volume
-- (2 500 FCFA le premier m³). Un colis de composants PC fait bien moins d'un m³ : au-delà de 10 kg
-- on retient le tarif d'un m³.
--
-- Prix facturé au client (arrondi à 500 FCFA) : couvre les frais Mobile Money, les appels au client,
-- les livraisons manquées à représenter et l'emballage, et laisse une marge.
--   jusqu'à 5 kg  : coût 1 500 → prix 2 000 (+500)
--   jusqu'à 10 kg : coût 1 700 → prix 2 500 (+800)
--   au-delà       : coût 2 500 → prix 3 500 (+1 000)
-- Le script peut être relancé sans risque.

-- Poids d'expédition de chaque produit (emballage compris), public : le panier additionne les poids.
alter table public.products add column if not exists cm_kg numeric(5,2);
grant select (cm_kg) on public.products to anon, authenticated;

-- Prix de vente, visibles par les clients.
create table if not exists public.cm_lastmile_rates (
  carrier text not null,
  max_kg numeric(6,2),            -- null : tranche « au-delà de 10 kg »
  fee_xaf integer not null check (fee_xaf >= 0),
  primary key (carrier, fee_xaf)
);
alter table public.cm_lastmile_rates enable row level security;
grant select on public.cm_lastmile_rates to anon, authenticated;
drop policy if exists "tarifs de livraison lisibles" on public.cm_lastmile_rates;
create policy "tarifs de livraison lisibles" on public.cm_lastmile_rates for select to anon, authenticated using (true);

-- Coûts du livreur : jamais exposés (schéma privé), pour suivre la marge.
create table if not exists private.cm_lastmile_costs (
  carrier text not null,
  max_kg numeric(6,2),
  cost_xaf integer not null check (cost_xaf >= 0),
  primary key (carrier, cost_xaf)
);

delete from public.cm_lastmile_rates where carrier = 'KAMDEM Delivery';
insert into public.cm_lastmile_rates (carrier, max_kg, fee_xaf) values
  ('KAMDEM Delivery', 5, 2000),
  ('KAMDEM Delivery', 10, 2500),
  ('KAMDEM Delivery', null, 3500);

delete from private.cm_lastmile_costs where carrier = 'KAMDEM Delivery';
insert into private.cm_lastmile_costs (carrier, max_kg, cost_xaf) values
  ('KAMDEM Delivery', 5, 1500),
  ('KAMDEM Delivery', 10, 1700),
  ('KAMDEM Delivery', null, 2500);

-- Le tarif ne dépend plus de la ville : fee_xaf devient un supplément éventuel par zone.
comment on column public.cm_delivery_zones.fee_xaf is 'Supplément par ville en plus de la grille au poids (0 par défaut)';
update public.cm_delivery_zones set fee_xaf = 0;

-- Le calcul des prix FCFA renseigne aussi le poids d'expédition de chaque produit.
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

select private.compute_cm_prices() as produits_recalcules;

-- Vérification : les trois tranches, avec coût, prix et marge.
select r.max_kg as jusqu_a_kg, c.cost_xaf as cout_kamdem, r.fee_xaf as prix_client, r.fee_xaf - c.cost_xaf as marge
from public.cm_lastmile_rates r
join private.cm_lastmile_costs c on c.carrier = r.carrier and c.max_kg is not distinct from r.max_kg
order by r.fee_xaf;
