-- Module pricing : coût réel, prix du marché, prix conseillé, promotions fournisseur, alertes et historiques.
-- Voir docs/module-pricing.md. Tout est réservé à l'administrateur (RLS) ; rien n'est exposé aux visiteurs.
-- Le script peut être relancé.

-- Réglages (une seule ligne) --------------------------------------------------------------------
create table if not exists private.pricing_settings (
  id boolean primary key default true check (id),
  stripe_pct numeric(5,2) not null default 1.5,              -- frais carte (cartes européennes)
  stripe_fixed_cents integer not null default 25,
  packaging_cents integer not null default 0,                -- emballage éventuel
  dropship_fee_cents integer not null default 0,             -- frais d'expédition 1foTrade par colis (à renseigner)
  aftersale_pct numeric(5,2) not null default 1.0,           -- provision SAV / retours
  target_below_min_pct numeric(5,2) not null default 3,      -- être de 3 %…
  target_below_max_pct numeric(5,2) not null default 6,      -- …à 6 % sous le prix moyen du marché
  auto_apply_max_pct numeric(5,2) not null default 5,        -- au-delà : validation manuelle
  supplier_promo_drop_pct numeric(5,2) not null default 8,   -- baisse de coût qui signale une promo fournisseur
  market_max_age_days smallint not null default 7            -- relevés concurrents pris en compte
);
insert into private.pricing_settings default values on conflict do nothing;

-- Marge minimale (le plancher du moteur), distincte de la marge cible déjà utilisée pour le prix par défaut.
alter table public.categories add column if not exists min_margin_pct numeric(5,2);
update public.categories set min_margin_pct = case slug
  when 'processeurs' then 3 when 'cartes-graphiques' then 3
  when 'cartes-meres' then 5 when 'memoire' then 5 when 'stockage' then 5 when 'ecrans' then 5
  when 'alimentations' then 6 when 'fauteuils' then 8 when 'boitiers' then 9 when 'refroidissement' then 10
  when 'peripheriques' then 12 else 15 end
where min_margin_pct is null;

-- Données de prix ajoutées aux produits (colonnes non accordées au public : invisibles côté site).
alter table public.products
  add column if not exists default_price_cents integer,   -- prix calculé à partir de la marge cible
  add column if not exists engine_price_cents integer,    -- prix appliqué par le moteur (null : prix par défaut)
  add column if not exists cost_ttc_cents integer,         -- coût fournisseur TVA comprise (réel, promo incluse)
  add column if not exists pricing_floor_cents integer;    -- plancher du moteur (coût complet + marge minimale)

-- Saisies manuelles : jamais modifiées par l'import ni par le moteur.
create table if not exists public.product_overrides (
  product_id bigint primary key references public.products(id) on delete cascade,
  fixed_price_cents integer check (fixed_price_cents > 0),
  min_margin_pct numeric(5,2) check (min_margin_pct between 0 and 80),
  min_margin_cents integer check (min_margin_cents >= 0),
  exclude_from_repricing boolean not null default false,
  featured boolean not null default false,
  note text check (length(note) <= 500),
  updated_at timestamptz not null default now()
);

-- Historiques ------------------------------------------------------------------------------------
create table if not exists public.supplier_cost_history (
  supplier_id text not null,
  supplier_sku text not null,
  ean text,
  cost_cents integer not null,
  in_stock boolean not null,
  recorded_at timestamptz not null default now()
);
create index if not exists supplier_cost_history_idx on public.supplier_cost_history (supplier_id, supplier_sku, recorded_at desc);
create index if not exists supplier_cost_history_ean_idx on public.supplier_cost_history (ean, recorded_at desc);

create table if not exists public.margin_history (
  product_id bigint not null references public.products(id) on delete cascade,
  price_cents integer not null,
  cost_ttc_cents integer not null,
  margin_cents integer not null,
  recorded_at timestamptz not null default now()
);
create index if not exists margin_history_idx on public.margin_history (product_id, recorded_at desc);

-- Concurrents -------------------------------------------------------------------------------------
create table if not exists public.competitors (
  id smallint generated always as identity primary key,
  name text not null unique check (length(name) <= 60),
  domain text not null unique check (domain ~ '^[a-z0-9.-]+$'),
  collect boolean not null default true,      -- relevé automatique autorisé (robots.txt)
  active boolean not null default true,
  last_status text,
  last_checked_at timestamptz
);
insert into public.competitors (name, domain, collect) values
  ('LDLC', 'www.ldlc.com', true),
  ('Materiel.net', 'www.materiel.net', true),
  ('TopAchat', 'www.topachat.com', true),
  ('Cdiscount', 'www.cdiscount.com', true),
  ('Amazon', 'www.amazon.fr', false),            -- conditions d'utilisation : collecte automatisée interdite, CSV seulement
  ('Rue du Commerce', 'www.rueducommerce.fr', true),
  ('Grosbill', 'www.grosbill.com', true)
on conflict (name) do nothing;

create table if not exists public.competitor_urls (
  product_id bigint not null references public.products(id) on delete cascade,
  competitor_id smallint not null references public.competitors(id) on delete cascade,
  url text not null check (url ~ '^https://' and length(url) <= 500),
  last_status text,
  last_checked_at timestamptz,
  primary key (product_id, competitor_id)
);

create table if not exists public.competitor_prices (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  competitor_id smallint not null references public.competitors(id) on delete cascade,
  price_cents integer not null check (price_cents > 0),
  in_stock boolean,
  source text not null check (source in ('collecteur', 'csv', 'manuel')),
  observed_at timestamptz not null default now()
);
create index if not exists competitor_prices_idx on public.competitor_prices (product_id, competitor_id, observed_at desc);

-- Résultat du moteur --------------------------------------------------------------------------------
create table if not exists public.pricing_suggestions (
  product_id bigint primary key references public.products(id) on delete cascade,
  cost_real_cents integer not null,
  floor_cents integer not null,
  market_min_cents integer,
  market_avg_cents integer,
  market_max_cents integer,
  market_count smallint not null default 0,
  cheapest_competitor_id smallint references public.competitors(id) on delete set null,
  current_cents integer not null,
  suggested_cents integer not null,
  margin_cents integer not null,
  margin_pct numeric(6,2) not null,
  rank smallint,                       -- 1 = le moins cher du marché
  status text not null check (status in ('tres_competitif', 'bien', 'trop_cher', 'marge_insuffisante', 'sans_donnees')),
  decision text not null check (decision in ('aucune', 'auto', 'a_valider', 'applique', 'refuse', 'verrouille')),
  computed_at timestamptz not null default now()
);
create index if not exists pricing_suggestions_status_idx on public.pricing_suggestions (status, decision);

-- Promotions fournisseur détectées --------------------------------------------------------------------
create table if not exists public.supplier_promotions (
  id bigint generated always as identity primary key,
  supplier_id text not null,
  supplier_sku text not null,
  ean text,
  normal_cost_cents integer not null,
  promo_cost_cents integer not null,
  drop_pct numeric(5,2) not null,
  promotion_id bigint references public.promotions(id) on delete set null,
  detected_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index if not exists supplier_promotions_active_idx
  on public.supplier_promotions (supplier_id, supplier_sku) where ended_at is null;

-- Alertes ---------------------------------------------------------------------------------------
create table if not exists public.pricing_alerts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('concurrent_moins_cher', 'promo_fournisseur', 'fin_promo_fournisseur',
                                     'marge_faible', 'rupture_fournisseur', 'a_valider')),
  product_id bigint references public.products(id) on delete cascade,
  message text not null check (length(message) <= 300),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists pricing_alerts_unread_idx on public.pricing_alerts (created_at desc) where read_at is null;

create or replace function private.alert(p_kind text, p_product bigint, p_message text)
returns void language sql security definer set search_path = '' as $$
  -- Une seule alerte non lue par type et par produit.
  insert into public.pricing_alerts (kind, product_id, message)
  select p_kind, p_product, left(p_message, 300)
  where not exists (select 1 from public.pricing_alerts a
                    where a.kind = p_kind and a.product_id is not distinct from p_product and a.read_at is null);
$$;

-- Droits : admin uniquement ------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['product_overrides', 'supplier_cost_history', 'margin_history', 'competitors',
    'competitor_urls', 'competitor_prices', 'pricing_suggestions', 'supplier_promotions', 'pricing_alerts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "admin" on public.%I', t);
    execute format('create policy "admin" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
-- Les historiques et calculs ne s'écrivent que par le serveur (fonctions), pas à la main.
revoke insert, update, delete on public.supplier_cost_history, public.margin_history, public.pricing_suggestions,
  public.supplier_promotions from authenticated;
revoke insert, delete on public.pricing_alerts from authenticated;
-- Données de coût des produits : jamais accordées aux comptes connectés (un client pourrait les lire) ;
-- l'admin les lit par une fonction dédiée.
revoke select (default_price_cents, engine_price_cents, cost_ttc_cents, pricing_floor_cents) on public.products from anon, authenticated;
create or replace function public.admin_product_costs(p_id bigint)
returns table (default_price_cents integer, engine_price_cents integer, cost_ttc_cents integer,
               pricing_floor_cents integer, floor_cents integer)
language sql stable security definer set search_path = '' as $$
  select p.default_price_cents, p.engine_price_cents, p.cost_ttc_cents, p.pricing_floor_cents, p.floor_cents
  from public.products p where p.id = p_id and public.is_admin();
$$;
revoke execute on function public.admin_product_costs(bigint) from public, anon;
grant execute on function public.admin_product_costs(bigint) to authenticated;
grant select on public.price_history to authenticated;
drop policy if exists "admin" on public.price_history;
create policy "admin" on public.price_history for select to authenticated using (public.is_admin());

-- Réglages lisibles et modifiables par l'admin via des fonctions.
create or replace function public.admin_pricing_settings()
returns setof private.pricing_settings language sql stable security definer set search_path = '' as $$
  select * from private.pricing_settings where public.is_admin();
$$;
create or replace function public.admin_update_pricing_settings(p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'réservé à l''administrateur' using errcode = '42501'; end if;
  update private.pricing_settings set
    stripe_pct = coalesce((p->>'stripe_pct')::numeric, stripe_pct),
    stripe_fixed_cents = coalesce((p->>'stripe_fixed_cents')::integer, stripe_fixed_cents),
    packaging_cents = coalesce((p->>'packaging_cents')::integer, packaging_cents),
    dropship_fee_cents = coalesce((p->>'dropship_fee_cents')::integer, dropship_fee_cents),
    aftersale_pct = coalesce((p->>'aftersale_pct')::numeric, aftersale_pct),
    target_below_min_pct = coalesce((p->>'target_below_min_pct')::numeric, target_below_min_pct),
    target_below_max_pct = coalesce((p->>'target_below_max_pct')::numeric, target_below_max_pct),
    auto_apply_max_pct = coalesce((p->>'auto_apply_max_pct')::numeric, auto_apply_max_pct),
    supplier_promo_drop_pct = coalesce((p->>'supplier_promo_drop_pct')::numeric, supplier_promo_drop_pct);
end;
$$;

-- Déclencheurs d'historique ------------------------------------------------------------------------
create or replace function private.log_supplier_cost()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.cost_cents is distinct from old.cost_cents or new.in_stock is distinct from old.in_stock then
    insert into public.supplier_cost_history (supplier_id, supplier_sku, ean, cost_cents, in_stock)
    values (new.supplier_id, new.supplier_sku, new.ean, new.cost_cents, new.in_stock);
  end if;
  -- Rupture chez le fournisseur sur un produit suivi (vendu, mis en avant ou surveillé).
  if tg_op = 'UPDATE' and old.in_stock and not new.in_stock and new.ean is not null then
    perform private.alert('rupture_fournisseur', p.id, 'Rupture chez 1foTrade : ' || p.brand || ' ' || left(p.name, 120))
    from public.products p
    where p.ean = new.ean and (
      exists (select 1 from public.order_items i where i.product_id = p.id)
      or exists (select 1 from public.product_overrides o where o.product_id = p.id and o.featured)
      or exists (select 1 from public.competitor_urls u where u.product_id = p.id));
  end if;
  return new;
end;
$$;
drop trigger if exists supplier_offers_cost_history on public.supplier_offers;
create trigger supplier_offers_cost_history after insert or update of cost_cents, in_stock on public.supplier_offers
  for each row execute function private.log_supplier_cost();
-- Point de départ de l'historique.
insert into public.supplier_cost_history (supplier_id, supplier_sku, ean, cost_cents, in_stock)
select supplier_id, supplier_sku, ean, cost_cents, in_stock from public.supplier_offers o
where not exists (select 1 from public.supplier_cost_history h where h.supplier_id = o.supplier_id and h.supplier_sku = o.supplier_sku);

create or replace function private.log_margin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.cost_ttc_cents is not null and (tg_op = 'INSERT' or new.price_cents is distinct from old.price_cents
     or new.cost_ttc_cents is distinct from old.cost_ttc_cents) then
    insert into public.margin_history (product_id, price_cents, cost_ttc_cents, margin_cents)
    values (new.id, new.price_cents, new.cost_ttc_cents, new.price_cents - new.cost_ttc_cents);
  end if;
  return new;
end;
$$;
drop trigger if exists products_margin_history on public.products;
create trigger products_margin_history after insert or update of price_cents, cost_ttc_cents on public.products
  for each row execute function private.log_margin();

-- Relevé concurrent : alerte quand un concurrent passe sous notre prix.
create or replace function private.on_competitor_price()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_price integer;
  v_prev integer;
  v_name text;
begin
  select coalesce(promo_price_cents, price_cents) into v_price from public.products where id = new.product_id;
  select price_cents into v_prev from public.competitor_prices
  where product_id = new.product_id and competitor_id = new.competitor_id and id <> new.id
  order by observed_at desc limit 1;
  if new.price_cents < v_price and (v_prev is null or v_prev >= v_price) then
    select name into v_name from public.competitors where id = new.competitor_id;
    perform private.alert('concurrent_moins_cher', new.product_id,
      v_name || ' est moins cher : ' || to_char(new.price_cents / 100.0, 'FM999990.00') || ' € contre '
      || to_char(v_price / 100.0, 'FM999990.00') || ' €');
  end if;
  return new;
end;
$$;
drop trigger if exists competitor_prices_alert on public.competitor_prices;
create trigger competitor_prices_alert after insert on public.competitor_prices
  for each row execute function private.on_competitor_price();

-- Promotions fournisseur : baisse du coût par rapport à la médiane des 30 derniers jours ---------------------
create or replace function private.detect_supplier_promos()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  s private.pricing_settings;
  n integer := 0;
  r record;
  v_pid bigint;
  v_promo bigint;
begin
  select * into s from private.pricing_settings;

  for r in
    with med as (
      select h.supplier_id, h.supplier_sku,
             percentile_cont(0.5) within group (order by h.cost_cents)::integer as normal_cost,
             max(h.recorded_at) - min(h.recorded_at) as span
      from public.supplier_cost_history h
      where h.recorded_at > now() - interval '30 days'
      group by h.supplier_id, h.supplier_sku
    )
    select o.supplier_id, o.supplier_sku, o.ean, o.cost_cents, m.normal_cost,
           round(100 * (1 - o.cost_cents::numeric / m.normal_cost), 2) as drop_pct
    from public.supplier_offers o
    join med m using (supplier_id, supplier_sku)
    where o.status = 'ok' and o.in_stock and o.ean is not null
      and m.span >= interval '3 days'
      and o.cost_cents <= m.normal_cost * (1 - s.supplier_promo_drop_pct / 100)
      and not exists (select 1 from public.supplier_promotions sp
                      where sp.supplier_id = o.supplier_id and sp.supplier_sku = o.supplier_sku and sp.ended_at is null)
  loop
    select id into v_pid from public.products where ean = r.ean;
    if v_pid is null then continue; end if;
    insert into public.promotions (label, product_id, discount_pct, ends_at)
    values ('Bon plan fournisseur', v_pid, least(50, greatest(1, r.drop_pct)), now() + interval '3 days')
    returning id into v_promo;
    insert into public.supplier_promotions (supplier_id, supplier_sku, ean, normal_cost_cents, promo_cost_cents, drop_pct, promotion_id)
    values (r.supplier_id, r.supplier_sku, r.ean, r.normal_cost, r.cost_cents, r.drop_pct, v_promo);
    perform private.alert('promo_fournisseur', v_pid, 'Promotion 1foTrade : coût −' || r.drop_pct || ' %, répercutée en vitrine');
    n := n + 1;
  end loop;

  -- Promotions toujours en cours : prolongées. Coût revenu à la normale (ou rupture) : terminées.
  for r in
    select sp.id, sp.promotion_id, sp.ean, o.cost_cents, o.in_stock, sp.normal_cost_cents
    from public.supplier_promotions sp
    left join public.supplier_offers o on o.supplier_id = sp.supplier_id and o.supplier_sku = sp.supplier_sku
    where sp.ended_at is null
  loop
    if r.cost_cents is null or not r.in_stock or r.cost_cents > r.normal_cost_cents * (1 - s.supplier_promo_drop_pct / 200) then
      update public.supplier_promotions set ended_at = now() where id = r.id;
      update public.promotions set active = false where id = r.promotion_id;
      select id into v_pid from public.products where ean = r.ean;
      if v_pid is not null then
        perform private.alert('fin_promo_fournisseur', v_pid, 'Fin de la promotion 1foTrade : prix normal rétabli');
      end if;
    else
      update public.promotions set ends_at = now() + interval '3 days' where id = r.promotion_id;
    end if;
  end loop;
  return n;
end;
$$;

-- Calcul du catalogue (reprend la version précédente) --------------------------------------------------
-- Ajouts : coût et plancher du moteur, prix par défaut séparé du prix appliqué, prise en compte du prix imposé
-- et du prix du moteur, et prix normal conservé pendant une promotion fournisseur (le rabais passe par la
-- promotion, avec un prix barré légal).
create or replace function private.refresh_products()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
  s private.pricing_settings;
begin
  select * into s from private.pricing_settings;
  perform private.detect_supplier_promos();

  with offers as (
    select o.supplier_id, o.supplier_sku, o.ean, o.name, o.brand, o.family, o.cost_cents, o.in_stock,
           private.classify(f.category_slug, o.name) as category_slug, s2.lead_days, s2.reliability,
           round(o.cost_cents * case when s2.prices_include_vat then 1 else 1.2 end)::integer as cost_ttc,
           -- Pendant une promotion fournisseur, le prix de vente reste calculé sur le coût habituel.
           round(coalesce(sp.normal_cost_cents, o.cost_cents) * case when s2.prices_include_vat then 1 else 1.2 end)::integer as list_cost_ttc
    from public.supplier_offers o
    join public.suppliers s2 on s2.id = o.supplier_id and s2.active
    join public.supplier_families f on f.supplier_id = o.supplier_id and f.family = o.family
    left join public.supplier_promotions sp
      on sp.supplier_id = o.supplier_id and sp.supplier_sku = o.supplier_sku and sp.ended_at is null
    where o.status = 'ok' and o.ean is not null
  ),
  best as (
    select distinct on (ean) *
    from offers
    order by ean, in_stock desc, cost_ttc / reliability asc, lead_days asc
  ),
  priced as (
    select b.*,
           greatest(b.list_cost_ttc * (1 + c.margin_pct / 100), b.list_cost_ttc + c.min_margin_cents) as target_price,
           -- Plancher absolu (promotions) : coût réel + frais + marge minimale en euros.
           (ceil((b.cost_ttc + s.packaging_cents + s.dropship_fee_cents + s.stripe_fixed_cents + c.min_margin_cents - 90)
                 / (1 - (s.stripe_pct + s.aftersale_pct) / 100) / 100.0) * 100 + 90)::integer as promo_floor,
           c.min_margin_pct, c.min_margin_cents as cat_min_cents
    from best b join public.categories c on c.slug = b.category_slug
  ),
  final as (
    select pr.*,
           (ceil((target_price - 90) / 100.0) * 100 + 90)::integer as default_price,
           -- Plancher du moteur : coût complet + max(marge minimale %, marge minimale €), produit ou catégorie.
           (ceil(((pr.cost_ttc + s.packaging_cents + s.dropship_fee_cents + s.stripe_fixed_cents
                   -- Minimum en euros du moteur : la moitié de celui de la catégorie (le prix par défaut
                   -- garde le minimum complet), sauf valeur propre au produit.
                   + greatest(pr.cost_ttc * coalesce(ov.min_margin_pct, pr.min_margin_pct, 0) / 100,
                              coalesce(ov.min_margin_cents, pr.cat_min_cents / 2)))
                  / (1 - (s.stripe_pct + s.aftersale_pct) / 100) - 90) / 100.0) * 100 + 90)::integer as engine_floor,
           ov.fixed_price_cents
    from priced pr
    left join public.products px on px.ean = pr.ean
    left join public.product_overrides ov on ov.product_id = px.id
  )
  insert into public.products as p
    (ean, slug, name, brand, category_slug, subcategory, price_cents, default_price_cents, floor_cents,
     pricing_floor_cents, cost_ttc_cents, in_stock, lead_days, socket, memory, psu_watts, active, updated_at)
  select ean,
         private.slugify(name) || '-' || left(md5(ean), 6),
         name, brand, category_slug,
         private.subclassify(category_slug, family, name,
           case when category_slug = 'alimentations' then ((regexp_match(name, '(\d{3,4}) ?W'))[1])::integer end),
         greatest(coalesce(fixed_price_cents, default_price), promo_floor),
         default_price,
         promo_floor,
         engine_floor,
         cost_ttc,
         in_stock, lead_days,
         case when category_slug in ('processeurs', 'cartes-meres')
              then replace((regexp_match(name, '(AM5|AM4|LGA ?1851|LGA ?1700)'))[1], ' ', '') end,
         case when category_slug in ('memoire', 'cartes-meres')
              then coalesce(
                (regexp_match(name, '(DDR5|DDR4)'))[1],
                case when category_slug = 'cartes-meres' then
                  case when name ~ '(AM5|LGA ?1851)' then 'DDR5' when name ~ 'AM4' then 'DDR4' end
                end) end,
         case when category_slug = 'alimentations'
              then ((regexp_match(name, '(\d{3,4}) ?W'))[1])::integer end,
         true, now()
  from final
  on conflict (ean) do update set
    name = excluded.name,
    brand = excluded.brand,
    category_slug = excluded.category_slug,
    subcategory = excluded.subcategory,
    -- Ordre de priorité : prix imposé > prix du moteur > prix par défaut ; jamais sous le plancher absolu.
    price_cents = greatest(
      coalesce((select o.fixed_price_cents from public.product_overrides o where o.product_id = p.id),
               case when p.engine_price_cents >= excluded.pricing_floor_cents then p.engine_price_cents end,
               excluded.default_price_cents),
      excluded.floor_cents),
    default_price_cents = excluded.default_price_cents,
    floor_cents = excluded.floor_cents,
    pricing_floor_cents = excluded.pricing_floor_cents,
    cost_ttc_cents = excluded.cost_ttc_cents,
    in_stock = excluded.in_stock,
    lead_days = excluded.lead_days,
    socket = excluded.socket,
    memory = excluded.memory,
    psu_watts = excluded.psu_watts,
    active = true,
    updated_at = now();
  get diagnostics n = row_count;

  update public.products p set active = false, updated_at = now()
  where p.active and not exists (
    select 1 from public.supplier_offers o
    join public.supplier_families f on f.supplier_id = o.supplier_id and f.family = o.family
    join public.suppliers s2 on s2.id = o.supplier_id and s2.active
    where o.ean = p.ean and o.status = 'ok'
  );
  perform private.apply_promotions();
  perform private.compute_cm_prices();
  perform private.compute_pricing();
  return n;
end;
$$;

-- Moteur de pricing ------------------------------------------------------------------------------
create or replace function private.round90_down(p numeric) returns integer language sql immutable as $$
  select (floor((p + 10) / 100) * 100 - 10)::integer;
$$;
create or replace function private.round90_up(p numeric) returns integer language sql immutable as $$
  select (ceil((p - 90) / 100.0) * 100 + 90)::integer;
$$;

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

  -- Alertes de marge (prix actuel sous le plancher du moteur, ex. prix imposé trop bas).
  perform private.alert('marge_faible', ps.product_id, 'Prix sous le plancher : ' || to_char(ps.current_cents / 100.0, 'FM999990.00')
    || ' € pour un minimum de ' || to_char(ps.floor_cents / 100.0, 'FM999990.00') || ' € (marge ' || ps.margin_pct || ' %)')
  from public.pricing_suggestions ps join public.products p on p.id = ps.product_id
  where ps.current_cents < ps.floor_cents and p.in_stock;
  return n;
end;
$$;

-- Actions de l'admin sur les suggestions ------------------------------------------------------------
create or replace function public.admin_pricing_decide(p_ids bigint[], p_accept boolean)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.is_admin() then raise exception 'réservé à l''administrateur' using errcode = '42501'; end if;
  if p_accept then
    update public.products p set engine_price_cents = ps.suggested_cents,
      price_cents = greatest(ps.suggested_cents, p.floor_cents), updated_at = now()
    from public.pricing_suggestions ps
    where ps.product_id = p.id and ps.product_id = any(p_ids) and ps.decision = 'a_valider';
    get diagnostics n = row_count;
    update public.pricing_suggestions set decision = 'applique', current_cents = suggested_cents
    where product_id = any(p_ids) and decision = 'a_valider';
  else
    update public.pricing_suggestions set decision = 'refuse' where product_id = any(p_ids) and decision = 'a_valider';
    get diagnostics n = row_count;
  end if;
  perform private.apply_promotions();
  return n;
end;
$$;

-- Saisie manuelle (prix imposé, marge propre, exclusion, mise en avant) puis recalcul du produit.
create or replace function public.admin_set_override(p_product bigint, p jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'réservé à l''administrateur' using errcode = '42501'; end if;
  insert into public.product_overrides (product_id, fixed_price_cents, min_margin_pct, min_margin_cents,
                                        exclude_from_repricing, featured, note, updated_at)
  values (p_product, (p->>'fixed_price_cents')::integer, (p->>'min_margin_pct')::numeric,
          (p->>'min_margin_cents')::integer, coalesce((p->>'exclude')::boolean, false),
          coalesce((p->>'featured')::boolean, false), nullif(p->>'note', ''), now())
  on conflict (product_id) do update set
    fixed_price_cents = excluded.fixed_price_cents, min_margin_pct = excluded.min_margin_pct,
    min_margin_cents = excluded.min_margin_cents, exclude_from_repricing = excluded.exclude_from_repricing,
    featured = excluded.featured, note = excluded.note, updated_at = now();
  -- Prix imposé : appliqué tout de suite (jamais sous le plancher absolu).
  update public.products p set price_cents = greatest(coalesce((p->>'fixed_price_cents')::integer,
      p.engine_price_cents, p.default_price_cents), p.floor_cents), updated_at = now()
  where p.id = p_product;
  perform private.compute_pricing();
  perform private.apply_promotions();
end;
$$;

-- Relance du moteur à la demande (après un import CSV de prix concurrents, par exemple).
create or replace function public.admin_run_pricing()
returns integer language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'réservé à l''administrateur' using errcode = '42501'; end if;
  return private.compute_pricing();
end;
$$;

-- Import CSV de prix concurrents (EAN, concurrent, prix, URL facultative).
create or replace function public.admin_import_competitor_prices(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ok integer := 0;
  ko integer := 0;
  r jsonb;
  v_pid bigint;
  v_cid smallint;
  v_price integer;
begin
  if not public.is_admin() then raise exception 'réservé à l''administrateur' using errcode = '42501'; end if;
  if jsonb_array_length(p_rows) > 5000 then raise exception '5000 lignes au plus'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    select id into v_pid from public.products where ean = r->>'ean';
    select id into v_cid from public.competitors where lower(name) = lower(btrim(r->>'concurrent'));
    v_price := round((replace(r->>'prix', ',', '.'))::numeric * 100);
    if v_pid is null or v_cid is null or v_price is null or v_price <= 0 then ko := ko + 1; continue; end if;
    insert into public.competitor_prices (product_id, competitor_id, price_cents, in_stock, source)
    values (v_pid, v_cid, v_price, true, 'csv');
    if (r->>'url') ~ '^https://' then
      insert into public.competitor_urls (product_id, competitor_id, url) values (v_pid, v_cid, left(r->>'url', 500))
      on conflict (product_id, competitor_id) do update set url = excluded.url;
    end if;
    ok := ok + 1;
  end loop;
  perform private.compute_pricing();
  return jsonb_build_object('importes', ok, 'ignores', ko);
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'prix illisible dans le fichier';
end;
$$;

-- Collecteur de prix (script serveur, protégé par le jeton d'import) ---------------------------------
create or replace function public.collector_todo(p_token text, p_limit integer)
returns table (product_id bigint, competitor_id smallint, domain text, url text, ean text)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_import_token(p_token);
  return query
    select u.product_id, u.competitor_id, c.domain, u.url, p.ean
    from public.competitor_urls u
    join public.competitors c on c.id = u.competitor_id and c.active and c.collect
    join public.products p on p.id = u.product_id and p.active
    order by u.last_checked_at nulls first
    limit least(p_limit, 2000);
end;
$$;

create or replace function public.collector_record(p_token text, p_rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer := 0;
  r jsonb;
begin
  perform private.assert_import_token(p_token);
  for r in select * from jsonb_array_elements(p_rows) loop
    update public.competitor_urls set last_status = left(r->>'status', 60), last_checked_at = now()
    where product_id = (r->>'product_id')::bigint and competitor_id = (r->>'competitor_id')::smallint;
    if r->>'status' = 'ok' and (r->>'price_cents')::integer > 0 then
      insert into public.competitor_prices (product_id, competitor_id, price_cents, in_stock, source)
      values ((r->>'product_id')::bigint, (r->>'competitor_id')::smallint, (r->>'price_cents')::integer,
              (r->>'in_stock')::boolean, 'collecteur');
      n := n + 1;
    end if;
  end loop;
  update public.competitors c set last_checked_at = now(),
    last_status = (select r->>'status' from jsonb_array_elements(p_rows) r
                   where (r->>'competitor_id')::smallint = c.id order by (r->>'status') = 'ok' limit 1)
  where c.id in (select (r->>'competitor_id')::smallint from jsonb_array_elements(p_rows) r);
  perform private.compute_pricing();
  return n;
end;
$$;

-- Droits d'exécution --------------------------------------------------------------------------------
revoke execute on function private.alert(text, bigint, text), private.log_supplier_cost(), private.log_margin(),
  private.on_competitor_price(), private.detect_supplier_promos(), private.refresh_products(),
  private.compute_pricing() from public, anon, authenticated;
revoke execute on function public.admin_pricing_settings(), public.admin_update_pricing_settings(jsonb),
  public.admin_pricing_decide(bigint[], boolean), public.admin_set_override(bigint, jsonb),
  public.admin_run_pricing(), public.admin_import_competitor_prices(jsonb) from public, anon;
grant execute on function public.admin_pricing_settings(), public.admin_update_pricing_settings(jsonb),
  public.admin_pricing_decide(bigint[], boolean), public.admin_set_override(bigint, jsonb),
  public.admin_run_pricing(), public.admin_import_competitor_prices(jsonb) to authenticated;
revoke execute on function public.collector_todo(text, integer), public.collector_record(text, jsonb) from public;
grant execute on function public.collector_todo(text, integer), public.collector_record(text, jsonb) to anon, authenticated;

-- Calcul initial et tâche horaire ----------------------------------------------------------------------
select private.refresh_products();
select cron.unschedule(jobid) from cron.job where jobname = 'vetex-pricing';
select cron.schedule('vetex-pricing', '35 * * * *', 'select private.compute_pricing()');

-- Vitrine : produits mis en avant par l'admin (seuls les identifiants sont exposés).
create or replace function public.featured_product_ids()
returns setof bigint language sql stable security definer set search_path = '' as $$
  select o.product_id from public.product_overrides o
  join public.products p on p.id = o.product_id and p.active and p.in_stock
  where o.featured order by o.updated_at desc limit 24;
$$;
revoke execute on function public.featured_product_ids() from public;
grant execute on function public.featured_product_ids() to anon, authenticated;
