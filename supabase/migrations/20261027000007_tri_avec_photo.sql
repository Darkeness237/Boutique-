-- Les produits avec photo passent en premier dans le tri « Pertinence ».
alter table public.products add column if not exists has_image boolean generated always as (image_url is not null) stored;
grant select (has_image) on public.products to anon, authenticated;
create index if not exists products_listing_idx on public.products (category_slug, in_stock desc, has_image desc, price_cents) where active;
