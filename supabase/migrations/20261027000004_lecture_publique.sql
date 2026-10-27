-- Le public ne doit voir ni les marges ni les prix d'achat : lecture limitée colonne par colonne.
revoke select on public.categories from anon, authenticated;
grant select (slug, name, hint, sort) on public.categories to anon, authenticated;

revoke select on public.products from anon, authenticated;
grant select (id, slug, name, brand, category_slug, price_cents, in_stock, lead_days,
              socket, memory, psu_watts, specs, image_url, active, updated_at)
  on public.products to anon, authenticated;

-- Marques présentes dans une catégorie (pour les filtres du catalogue).
create or replace function public.category_brands(p_category text)
returns table (brand text, products bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.brand, count(*)
  from public.products p
  where p.active and p.brand <> '' and (p_category is null or p.category_slug = p_category)
  group by p.brand
  order by p.brand;
$$;
grant execute on function public.category_brands(text) to anon, authenticated;
