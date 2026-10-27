import { activePromo, inStock, type Product } from "./catalog";

export type Deal = { category: string; maxPct: number; label: string; endsAt: string; items: Product[] };

/** Offres en cours d'un rayon, calculées à partir des produits (les promotions elles-mêmes restent privées). */
export async function dealsIn(category: string, limit = 24): Promise<Deal | null> {
  // Large échantillon pour que « jusqu'à −X % » soit exact, puis on ne garde que les meilleures remises.
  const items = await inStock(category, { promoOnly: true, withImage: true }, 400);
  const promos = items.map((p) => ({ p, promo: activePromo(p) })).filter((x) => x.promo);
  if (!promos.length) return null;
  promos.sort((a, b) => b.promo!.pct - a.promo!.pct);
  return {
    category,
    maxPct: promos[0].promo!.pct,
    label: promos[0].promo!.label,
    endsAt: promos.map((x) => x.promo!.endsAt).sort()[0],
    items: promos.slice(0, limit).map((x) => x.p),
  };
}
