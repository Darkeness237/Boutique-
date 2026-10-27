-- Sous-catégories, historique des prix et promotions.
--
-- Règle légale (art. L112-1-1 du Code de la consommation) : le prix barré d'une promotion est
-- le prix le plus bas pratiqué dans les 30 jours précédents. Il est calculé depuis
-- price_history, jamais saisi à la main.

-- Sous-catégories ---------------------------------------------------------------
create table public.subcategories (
  category_slug text not null references public.categories(slug) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{1,40}$'),
  name text not null,
  sort smallint not null default 0,
  primary key (category_slug, slug)
);
alter table public.subcategories enable row level security;
grant select on public.subcategories to anon, authenticated;
create policy "sous-catégories lisibles" on public.subcategories for select to anon, authenticated using (true);

insert into public.subcategories (category_slug, slug, name, sort) values
  ('processeurs', 'amd', 'AMD Ryzen', 1),
  ('processeurs', 'intel', 'Intel Core', 2),
  ('cartes-meres', 'am5', 'Socket AM5', 1),
  ('cartes-meres', 'am4', 'Socket AM4', 2),
  ('cartes-meres', 'lga1851', 'Socket LGA1851', 3),
  ('cartes-meres', 'lga1700', 'Socket LGA1700', 4),
  ('cartes-graphiques', 'nvidia', 'NVIDIA GeForce', 1),
  ('cartes-graphiques', 'amd', 'AMD Radeon', 2),
  ('cartes-graphiques', 'intel', 'Intel Arc', 3),
  ('memoire', 'ddr5', 'DDR5', 1),
  ('memoire', 'ddr4', 'DDR4', 2),
  ('memoire', 'portable', 'Pour PC portable (SO-DIMM)', 3),
  ('stockage', 'ssd-nvme', 'SSD NVMe M.2', 1),
  ('stockage', 'ssd-sata', 'SSD SATA', 2),
  ('stockage', 'disques-durs', 'Disques durs', 3),
  ('stockage', 'cles-usb', 'Clés USB', 4),
  ('stockage', 'cartes-memoire', 'Cartes mémoire', 5),
  ('alimentations', 'moins-650w', 'Moins de 650 W', 1),
  ('alimentations', '650-850w', 'De 650 à 850 W', 2),
  ('alimentations', 'plus-850w', 'Plus de 850 W', 3),
  ('boitiers', 'moyen-tour', 'Moyen tour', 1),
  ('boitiers', 'mini-tour', 'Mini tour et compacts', 2),
  ('boitiers', 'grand-tour', 'Grand tour', 3),
  ('refroidissement', 'ventirads', 'Ventirads', 1),
  ('refroidissement', 'watercooling', 'Watercooling', 2),
  ('refroidissement', 'ventilateurs', 'Ventilateurs de boîtier', 3),
  ('refroidissement', 'pates-accessoires', 'Pâtes thermiques et accessoires', 4),
  ('ecrans', 'moins-27', 'Moins de 27 pouces', 1),
  ('ecrans', '27-et-plus', '27 pouces et plus', 2),
  ('ecrans', 'incurves', 'Incurvés', 3),
  ('ecrans', 'portables', 'Écrans portables', 4),
  ('ecrans', 'supports', 'Supports et bras', 5),
  ('peripheriques', 'souris', 'Souris', 1),
  ('peripheriques', 'claviers', 'Claviers', 2),
  ('peripheriques', 'casques', 'Casques', 3),
  ('peripheriques', 'packs', 'Packs clavier et souris', 4),
  ('peripheriques', 'tapis', 'Tapis de souris', 5),
  ('peripheriques', 'manettes', 'Manettes et volants', 6);

create or replace function private.subclassify(p_category text, p_family text, p_name text, p_watts integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_category
    when 'processeurs' then case
      when p_name ~* '(ryzen|athlon|threadripper)' then 'amd'
      when p_name ~* '(core|pentium|celeron|xeon)' then 'intel' end
    when 'cartes-meres' then case
      when p_name ~ 'AM5' then 'am5' when p_name ~ 'AM4' then 'am4'
      when p_name ~ 'LGA ?1851' then 'lga1851' when p_name ~ 'LGA ?1700' then 'lga1700' end
    when 'cartes-graphiques' then case
      when p_name ~* '(geforce|\mrtx\M|\mgtx\M|quadro)' then 'nvidia'
      when p_name ~* '(radeon|\mrx ?\d)' then 'amd'
      when p_name ~* '\marc\M' then 'intel' end
    when 'memoire' then case
      when p_name ~* 'so-?dimm' then 'portable'
      when p_name ~* 'ddr5' then 'ddr5' when p_name ~* 'ddr4' then 'ddr4' end
    when 'stockage' then case
      when p_name ~* 'ssd' and p_name ~* '(nvme|m\.2)' then 'ssd-nvme'
      when p_name ~* 'ssd' then 'ssd-sata'
      when p_name ~* 'disque dur' then 'disques-durs'
      when p_name ~* 'clé usb' then 'cles-usb'
      when p_name ~* 'carte mémoire' then 'cartes-memoire' end
    when 'alimentations' then case
      when p_watts is null then null
      when p_watts < 650 then 'moins-650w' when p_watts <= 850 then '650-850w' else 'plus-850w' end
    when 'boitiers' then case
      when p_name ~* '^boitier moyen' then 'moyen-tour'
      when p_name ~* '^boitier (mini|cube)' then 'mini-tour'
      when p_name ~* '^boitier grand' then 'grand-tour' end
    when 'refroidissement' then case p_family
      when 'Watercooling' then 'watercooling'
      when 'Ventilateur pour Processeur' then 'ventirads'
      when 'Ventilateur de Boîtier' then 'ventilateurs'
      else 'pates-accessoires' end
    when 'ecrans' then case
      when p_name ~* '^support' then 'supports'
      when p_name ~* 'portable' then 'portables'
      when p_name ~* 'incurvé' then 'incurves'
      when p_name ~ '(2[7-9]|[3-9]\d)([.,]\d)?"' then '27-et-plus'
      when p_name ~ '\d{2}([.,]\d)?"' then 'moins-27' end
    when 'peripheriques' then case p_family
      when 'Souris' then 'souris' when 'Clavier' then 'claviers' when 'Casque' then 'casques'
      when 'Pack Clavier - Souris' then 'packs' when 'Tapis de Souris' then 'tapis'
      when 'Périphérique de Jeu' then 'manettes' end
  end;
$$;
revoke execute on function private.subclassify(text, text, text, integer) from public, anon, authenticated;

-- Colonnes produit ----------------------------------------------------------------
alter table public.products
  add column subcategory text,
  -- Prix minimum autorisé (coût + marge minimale) : jamais exposé au public.
  add column floor_cents integer,
  add column promo_price_cents integer,
  add column promo_label text,
  add column promo_ends_at timestamptz,
  add column reference_price_cents integer;
create index products_subcategory_idx on public.products (category_slug, subcategory) where active;
create index products_promo_idx on public.products (promo_ends_at) where promo_price_cents is not null;
grant select (subcategory, promo_price_cents, promo_label, promo_ends_at, reference_price_cents)
  on public.products to anon, authenticated;

-- Historique des prix (prix normal, hors promotion) -------------------------------
create table public.price_history (
  product_id bigint not null references public.products(id) on delete cascade,
  price_cents integer not null,
  recorded_at timestamptz not null default now()
);
create index price_history_product_idx on public.price_history (product_id, recorded_at desc);
alter table public.price_history enable row level security;
revoke all on public.price_history from anon, authenticated;

create or replace function private.log_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.price_cents is distinct from old.price_cents then
    insert into public.price_history (product_id, price_cents) values (new.id, new.price_cents);
  end if;
  return new;
end;
$$;
create trigger products_price_history
  after insert or update of price_cents on public.products
  for each row execute function private.log_price();

-- Les prix actuels deviennent le point de départ de l'historique.
insert into public.price_history (product_id, price_cents) select id, price_cents from public.products;

-- Promotions --------------------------------------------------------------------
create table public.promotions (
  id bigint generated always as identity primary key,
  label text not null check (length(label) between 3 and 60),
  category_slug text references public.categories(slug),
  subcategory text,
  product_id bigint references public.products(id) on delete cascade,
  discount_pct numeric(4,1) not null check (discount_pct > 0 and discount_pct <= 50),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  active boolean not null default true,
  check (ends_at > starts_at),
  check (category_slug is not null or product_id is not null)
);
create index promotions_category_idx on public.promotions (category_slug);
create index promotions_product_idx on public.promotions (product_id);
alter table public.promotions enable row level security;
revoke all on public.promotions from anon, authenticated;

-- Applique la meilleure promotion en cours à chaque produit, sans jamais passer sous le plancher.
create or replace function private.apply_promotions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  with best as (
    select distinct on (p.id) p.id, pr.label, pr.ends_at,
           -- Arrondi au ,90 inférieur pour que la remise affichée soit au moins celle annoncée.
           (floor((p.price_cents * (1 - pr.discount_pct / 100) + 10) / 100) * 100 - 10)::integer as raw_price,
           p.floor_cents, p.price_cents
    from public.products p
    join public.promotions pr on pr.active and now() >= pr.starts_at and now() < pr.ends_at
      and (pr.product_id = p.id
           or (pr.product_id is null and pr.category_slug = p.category_slug
               and (pr.subcategory is null or pr.subcategory = p.subcategory)))
    where p.active
    order by p.id, pr.discount_pct desc
  ),
  priced as (
    select id, label, ends_at,
           greatest(raw_price, (ceil((coalesce(floor_cents, 0) - 90) / 100.0) * 100 + 90)::integer) as promo_price,
           price_cents
    from best
  ),
  reference as (
    select h.product_id, min(h.price_cents) as ref
    from public.price_history h
    where h.recorded_at > now() - interval '30 days'
    group by h.product_id
  )
  update public.products p set
    promo_price_cents = case when pr.promo_price <= pr.price_cents * 0.97 then pr.promo_price end,
    promo_label = case when pr.promo_price <= pr.price_cents * 0.97 then pr.label end,
    promo_ends_at = case when pr.promo_price <= pr.price_cents * 0.97 then pr.ends_at end,
    reference_price_cents = coalesce(r.ref, p.price_cents)
  from priced pr left join reference r on r.product_id = pr.id
  where p.id = pr.id;
  get diagnostics n = row_count;

  -- Promotion terminée ou retirée : on revient au prix normal.
  update public.products p set promo_price_cents = null, promo_label = null, promo_ends_at = null
  where p.promo_price_cents is not null
    and not exists (
      select 1 from public.promotions pr
      where pr.active and now() >= pr.starts_at and now() < pr.ends_at
        and (pr.product_id = p.id
             or (pr.product_id is null and pr.category_slug = p.category_slug
                 and (pr.subcategory is null or pr.subcategory = p.subcategory))));
  return n;
end;
$$;
revoke execute on function private.apply_promotions() from public, anon, authenticated;

-- Arbre du menu : catégories, sous-catégories et nombre de produits.
create or replace function public.category_tree()
returns table (category_slug text, category_name text, category_sort smallint,
               sub_slug text, sub_name text, sub_sort smallint, products bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.slug, c.name, c.sort, s.slug, s.name, s.sort,
         (select count(*) from public.products p
          where p.active and p.category_slug = c.slug and (s.slug is null or p.subcategory = s.slug))
  from public.categories c
  left join public.subcategories s on s.category_slug = c.slug
  order by c.sort, s.sort;
$$;
grant execute on function public.category_tree() to anon, authenticated;
