-- Le code EAN (imprimé sur chaque boîte) est une donnée publique : Google Shopping l'exige (GTIN)
-- et il figure dans les données structurées des fiches produits.
grant select (ean) on public.products to anon, authenticated;
