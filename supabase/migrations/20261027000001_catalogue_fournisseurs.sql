-- Silicium : catalogue multi-fournisseurs.
-- Règle d'or : les prix d'achat (supplier_offers) ne sont JAMAIS lisibles par le site public.
-- Le public ne lit que `products` (prix de vente) et `categories`.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Catégories et règles de marge ----------------------------------------------
create table public.categories (
  slug text primary key,
  name text not null,
  hint text not null default '',
  sort smallint not null default 0,
  -- Marge appliquée sur le coût d'achat TTC, en pourcentage.
  margin_pct numeric(5,2) not null check (margin_pct >= 0 and margin_pct < 200),
  -- Marge minimale en euros (centimes) : couvre les frais Stripe et le service client.
  min_margin_cents integer not null default 0 check (min_margin_cents >= 0)
);

-- Fournisseurs ---------------------------------------------------------------
create table public.suppliers (
  id text primary key check (id ~ '^[a-z0-9-]{2,32}$'),
  name text not null,
  prices_include_vat boolean not null default false,
  shipping_fee_cents integer not null default 0 check (shipping_fee_cents >= 0),
  lead_days smallint not null default 2 check (lead_days between 0 and 60),
  -- 1 = parfait ; baisse avec les ruptures et retards constatés.
  reliability numeric(3,2) not null default 1 check (reliability between 0 and 1),
  active boolean not null default true
);

-- Correspondance famille fournisseur -> catégorie Silicium.
create table public.supplier_families (
  supplier_id text not null references public.suppliers(id) on delete cascade,
  family text not null,
  category_slug text not null references public.categories(slug),
  primary key (supplier_id, family)
);
create index supplier_families_category_idx on public.supplier_families (category_slug);

-- Offres fournisseurs (prix d'achat) : confidentiel.
create table public.supplier_offers (
  supplier_id text not null references public.suppliers(id) on delete cascade,
  supplier_sku text not null check (length(supplier_sku) <= 64),
  ean text check (ean ~ '^[0-9]{8,14}$'),
  mpn text check (length(mpn) <= 128),
  family text not null check (length(family) <= 128),
  name text not null check (length(name) <= 300),
  brand text not null default '' check (length(brand) <= 80),
  cost_cents integer not null check (cost_cents > 0),
  previous_cost_cents integer,
  in_stock boolean not null,
  status text not null default 'ok' check (status in ('ok', 'quarantine')),
  quarantine_reason text,
  seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (supplier_id, supplier_sku)
);
create index supplier_offers_ean_idx on public.supplier_offers (ean) where ean is not null;
create index supplier_offers_quarantine_idx on public.supplier_offers (supplier_id) where status = 'quarantine';

-- Produits vendus (prix de vente, sans aucune information fournisseur).
create table public.products (
  id bigint generated always as identity primary key,
  ean text not null unique,
  slug text not null unique,
  name text not null,
  brand text not null default '',
  category_slug text not null references public.categories(slug),
  price_cents integer not null check (price_cents > 0),
  in_stock boolean not null,
  lead_days smallint not null default 2,
  socket text,
  memory text,
  psu_watts integer,
  specs jsonb not null default '{}'::jsonb,
  image_url text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products (category_slug, price_cents) where active;
create index products_brand_idx on public.products (brand) where active;
create extension if not exists pg_trgm with schema extensions;
create index products_name_trgm_idx on public.products using gin (name extensions.gin_trgm_ops);

-- Journal des imports.
create table public.import_runs (
  id bigint generated always as identity primary key,
  supplier_id text not null references public.suppliers(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_received integer not null default 0,
  rows_quarantined integer not null default 0
);
create index import_runs_supplier_idx on public.import_runs (supplier_id);

-- Jetons d'import : seul leur empreinte SHA-256 est stockée.
create table private.import_tokens (
  token_hash text primary key,
  label text not null,
  created_at timestamptz not null default now()
);

-- Droits ---------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.supplier_families enable row level security;
alter table public.supplier_offers enable row level security;
alter table public.products enable row level security;
alter table public.import_runs enable row level security;

-- Aucune politique pour anon/authenticated sur les tables fournisseurs = accès refusé.
revoke all on public.suppliers, public.supplier_families, public.supplier_offers, public.import_runs
  from anon, authenticated;

-- Lecture publique du catalogue uniquement.
revoke all on public.categories, public.products from anon, authenticated;
grant select on public.categories to anon, authenticated;
grant select on public.products to anon, authenticated;

create policy "catalogue lisible" on public.categories for select to anon, authenticated using (true);
create policy "produits actifs lisibles" on public.products for select to anon, authenticated using (active);
