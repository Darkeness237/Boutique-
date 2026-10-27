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
  subcategory: string | null;
  promo_price_cents: number | null;
  promo_label: string | null;
  promo_ends_at: string | null;
  /** Prix le plus bas des 30 derniers jours : seule base légale d'un prix barré. */
  reference_price_cents: number | null;
};

/** Promotion en cours (la date de fin est revérifiée ici, au cas où la base n'a pas encore été rafraîchie). */
export function activePromo(p: Product, now = Date.now()): { price: number; reference: number; pct: number; endsAt: string; label: string } | null {
  if (!p.promo_price_cents || !p.promo_ends_at || Date.parse(p.promo_ends_at) <= now) return null;
  const reference = p.reference_price_cents ?? p.price_cents;
  if (p.promo_price_cents >= reference) return null;
  return {
    price: p.promo_price_cents,
    reference,
    pct: Math.round((1 - p.promo_price_cents / reference) * 100),
    endsAt: p.promo_ends_at,
    label: p.promo_label ?? "Promotion",
  };
}

/** Prix réellement payé : celui de la promotion en cours, sinon le prix normal. */
export function effectivePrice(p: Product): number {
  return activePromo(p)?.price ?? p.price_cents;
}

/**
 * Les noms fournisseurs commencent par le type de produit (« Carte Graphique Asus … »).
 * On affiche le nom à partir de la marque, plus lisible dans une liste.
 */
export function displayName(p: Pick<Product, "name" | "brand">): string {
  const i = p.brand ? p.name.toLowerCase().indexOf(p.brand.toLowerCase()) : -1;
  const fromBrand = i >= 0 ? p.name.slice(i + p.brand.length).trim() : p.name;
  return fromBrand || p.name;
}
