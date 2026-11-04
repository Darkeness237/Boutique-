-- Second fournisseur : Picata. Ses catégories sont ramenées aux familles 1foTrade par le script d'import,
-- on reprend donc la même correspondance famille → rayon. Pour chaque produit (EAN), la base retient l'offre
-- en stock la moins chère entre les fournisseurs (voir private.refresh_products).
insert into public.suppliers (id, name, prices_include_vat, lead_days)
values ('picata', 'Picata', false, 2)
on conflict (id) do nothing;

insert into public.supplier_families (supplier_id, family, category_slug)
select 'picata', family, category_slug from public.supplier_families where supplier_id = '1fotrade'
on conflict do nothing;
