// Types et utilitaires produit partagés entre le serveur et le navigateur
// (ce fichier ne doit rien importer qui touche à la base).

export type Product = {
  id: number;
  slug: string;
  name: string;
  brand: string;
  category_slug: string;
  price_cents: number;
  in_stock: boolean;
  lead_days: number;
  socket: string | null;
  memory: string | null;
  psu_watts: number | null;
  image_url: string | null;
  /** Caractéristiques fabricant (Open Icecat), [libellé, valeur]. Objet vide si aucune. */
  specs: [string, string][] | Record<string, never>;
  media_source: string | null;
};

/**
 * Les noms fournisseurs commencent par le type de produit (« Carte Graphique Asus … »).
 * On affiche le nom à partir de la marque, plus lisible dans une liste.
 */
export function displayName(p: Pick<Product, "name" | "brand">): string {
  const i = p.brand ? p.name.toLowerCase().indexOf(p.brand.toLowerCase()) : -1;
  const fromBrand = i >= 0 ? p.name.slice(i + p.brand.length).trim() : p.name;
  return fromBrand || p.name;
}
