-- Positionnement face aux grandes enseignes (voir docs/module-pricing.md).
-- Sur les « produits d'appel » (cartes graphiques, processeurs), Amazon et les grandes enseignes vendent souvent
-- sous le prix d'achat d'un grossiste : on ne les met pas en avant. Le statut « non compétitif » signale les
-- produits qui, même vendus au plancher, restent plus chers que le concurrent le moins cher.
-- Le script peut être relancé.

alter table public.categories add column if not exists promote boolean not null default true;
update public.categories set promote = slug not in ('cartes-graphiques', 'processeurs');

alter table public.products add column if not exists promote boolean not null default true;
grant select (promote) on public.products to anon, authenticated;
create index if not exists products_promote_idx on public.products (category_slug) where promote and active and in_stock;

alter table public.pricing_suggestions drop constraint if exists pricing_suggestions_status_check;
alter table public.pricing_suggestions add constraint pricing_suggestions_status_check
  check (status in ('tres_competitif', 'bien', 'trop_cher', 'marge_insuffisante', 'non_competitif', 'sans_donnees'));

create or replace function private.compute_pricing()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  s private.pricing_settings;
  n integer;
begin
  select * into s from private.pricing_settings;

  with latest as (
    select distinct on (cp.product_id, cp.competitor_id) cp.product_id, cp.competitor_id, cp.price_cents
    from public.competitor_prices cp
    join public.competitors c on c.id = cp.competitor_id and c.active
    where cp.observed_at > now() - make_interval(days => s.market_max_age_days)
      and coalesce(cp.in_stock, true)
    order by cp.product_id, cp.competitor_id, cp.observed_at desc
  ),
  market as (
    select product_id, min(price_cents) as mn, round(avg(price_cents))::integer as av, max(price_cents) as mx,
           count(*)::smallint as cnt,
           (array_agg(competitor_id order by price_cents))[1] as cheapest
    from latest group by product_id
  ),
  base as (
    select p.id, p.price_cents as current, p.cost_ttc_cents as cost, p.pricing_floor_cents as floor,
           p.default_price_cents as dflt,
           m.mn, m.av, m.mx, coalesce(m.cnt, 0) as cnt, m.cheapest,
           ov.fixed_price_cents is not null or coalesce(ov.exclude_from_repricing, false) as locked,
           ps.decision as prev_decision, ps.suggested_cents as prev_suggested
    from public.products p
    left join market m on m.product_id = p.id
    left join public.product_overrides ov on ov.product_id = p.id
    left join public.pricing_suggestions ps on ps.product_id = p.id
    where p.active and p.cost_ttc_cents is not null and p.pricing_floor_cents is not null
  ),
  target as (
    select b.*,
           case when b.av is null then b.dflt else
             greatest(
               b.floor,
               -- Milieu de la bande sous la moyenne, ou juste sous le moins cher s'il reste dans la bande.
               private.round90_down(case
                 when b.mn < b.av * (1 - (s.target_below_min_pct + s.target_below_max_pct) / 200)
                      and b.mn >= b.av * (1 - s.target_below_max_pct / 100)
                   then b.mn - 100
                 else b.av * (1 - (s.target_below_min_pct + s.target_below_max_pct) / 200) end))
           end as suggested
    from base b
  ),
  scored as (
    select t.*,
           -- Coût complet au prix actuel (frais de paiement et SAV proportionnels au prix).
           t.cost + s.packaging_cents + s.dropship_fee_cents + s.stripe_fixed_cents
             + round(t.current * (s.stripe_pct + s.aftersale_pct) / 100)::integer as cost_real,
           case
             when t.av is null then 'sans_donnees'
             -- Même au plancher, on reste plus cher que le concurrent le moins cher : inutile de pousser ce produit.
             when t.floor > t.mn then 'non_competitif'
             when t.floor > t.av * (1 - s.target_below_min_pct / 100) then 'marge_insuffisante'
             when t.current <= t.mn then 'tres_competitif'
             when t.current <= t.av then 'bien'
             else 'trop_cher'
           end as status,
           (select count(*) + 1 from latest l where l.product_id = t.id and l.price_cents < t.current)::smallint as rnk
    from target t
  )
  insert into public.pricing_suggestions as ps
    (product_id, cost_real_cents, floor_cents, market_min_cents, market_avg_cents, market_max_cents, market_count,
     cheapest_competitor_id, current_cents, suggested_cents, margin_cents, margin_pct, rank, status, decision, computed_at)
  select id, cost_real, floor, mn, av, mx, cnt, cheapest, current, suggested,
         current - cost_real, round(100.0 * (current - cost_real) / nullif(current, 0), 2),
         case when cnt > 0 then rnk end, status,
         case
           when locked then 'verrouille'
           when av is null or suggested = current then 'aucune'
           -- Une suggestion déjà refusée n'est pas reproposée tant qu'elle ne change pas.
           when prev_decision = 'refuse' and prev_suggested = suggested then 'refuse'
           when abs(suggested - current) <= current * s.auto_apply_max_pct / 100 then 'auto'
           else 'a_valider'
         end,
         now()
  from scored
  on conflict (product_id) do update set
    cost_real_cents = excluded.cost_real_cents, floor_cents = excluded.floor_cents,
    market_min_cents = excluded.market_min_cents, market_avg_cents = excluded.market_avg_cents,
    market_max_cents = excluded.market_max_cents, market_count = excluded.market_count,
    cheapest_competitor_id = excluded.cheapest_competitor_id, current_cents = excluded.current_cents,
    suggested_cents = excluded.suggested_cents, margin_cents = excluded.margin_cents,
    margin_pct = excluded.margin_pct, rank = excluded.rank, status = excluded.status,
    decision = excluded.decision, computed_at = excluded.computed_at;
  get diagnostics n = row_count;

  -- Application automatique des petits écarts (jamais sous le plancher : garanti par le calcul).
  update public.products p set engine_price_cents = ps.suggested_cents, price_cents = ps.suggested_cents, updated_at = now()
  from public.pricing_suggestions ps
  where ps.product_id = p.id and ps.decision = 'auto' and ps.suggested_cents >= p.floor_cents;
  update public.pricing_suggestions set decision = 'applique', current_cents = suggested_cents where decision = 'auto';

  -- Mise en avant (accueil, bannières, flux Google Shopping) : rayons rentables et produits compétitifs seulement.
  update public.products p set promote = x.promote
  from (
    select p2.id,
           coalesce(c.promote, true) and coalesce(ps.status, '') <> 'non_competitif' as promote
    from public.products p2
    left join public.categories c on c.slug = p2.category_slug
    left join public.pricing_suggestions ps on ps.product_id = p2.id
  ) x
  where x.id = p.id and p.promote is distinct from x.promote;

  -- Alertes de marge (prix actuel sous le plancher du moteur, ex. prix imposé trop bas).
  perform private.alert('marge_faible', ps.product_id, 'Prix sous le plancher : ' || to_char(ps.current_cents / 100.0, 'FM999990.00')
    || ' € pour un minimum de ' || to_char(ps.floor_cents / 100.0, 'FM999990.00') || ' € (marge ' || ps.margin_pct || ' %)')
  from public.pricing_suggestions ps join public.products p on p.id = ps.product_id
  where ps.current_cents < ps.floor_cents and p.in_stock;
  return n;
end;
$$;

select private.compute_pricing();
