import { inStock, type Product } from "./catalog";
import { recommendedPsuWatts } from "./compat";
import type { Market } from "./market";

const middle = <T,>(list: T[]) => list[Math.floor(list.length / 2)];

/**
 * « Souvent achetés ensemble » : pas de statistiques de vente inventées, mais les pièces
 * qui vont réellement avec celle-ci (même socket, même mémoire, puissance suffisante…).
 */
export async function bundleFor(p: Product, market: Market = "fr"): Promise<Product[]> {
  const ram32 = (memory: string) =>
    inStock("memoire", { market, memory, nameMatches: ["32Go", "32 Go"] }, 20).then((l) => l.find((r) => /2 ?x/i.test(r.name)));

  switch (p.category_slug) {
    case "processeurs": {
      if (!p.socket) return [];
      const board = middle(await inStock("cartes-meres", { market, socket: p.socket, withImage: true }, 20));
      const ram = board?.memory ? await ram32(board.memory) : undefined;
      return [board, ram].filter((x): x is Product => Boolean(x));
    }
    case "cartes-meres": {
      if (!p.socket) return [];
      const cpu = middle(await inStock("processeurs", { market, socket: p.socket, minPriceCents: 15000 }, 20));
      const ram = p.memory ? await ram32(p.memory) : undefined;
      return [cpu, ram].filter((x): x is Product => Boolean(x));
    }
    case "cartes-graphiques": {
      const needed = recommendedPsuWatts([p, { category_slug: "processeurs", name: "Ryzen 7 9700X" }]);
      const psu = (await inStock("alimentations", { market, minPsuWatts: needed, minPriceCents: 6000 }, 30)).find((a) =>
        /80 ?(\+|plus)|\b(bronze|gold|platinum)\b/i.test(a.name),
      );
      return psu ? [psu] : [];
    }
    case "boitiers": {
      const fans = await inStock("refroidissement", { market, subcategory: "ventilateurs", withImage: true, minPriceCents: 1000 }, 20);
      return fans.length ? [middle(fans)] : [];
    }
    case "refroidissement": {
      if (p.subcategory !== "ventirads" && p.subcategory !== "watercooling") return [];
      const paste = (await inStock("refroidissement", { market, subcategory: "pates-accessoires", nameMatches: ["pâte", "pate"] }, 10))[0];
      return paste ? [paste] : [];
    }
    default:
      return [];
  }
}

/** Produits proches : même rayon et sous-rayon, prix comparable, en stock. */
export async function similarTo(p: Product, market: Market = "fr"): Promise<Product[]> {
  const list = await inStock(
    p.category_slug,
    {
      subcategory: p.subcategory ?? undefined,
      minPriceCents: Math.round(p.price_cents * 0.6),
      maxPriceCents: Math.round(p.price_cents * 1.5),
      excludeId: p.id,
      market,
    },
    30,
  );
  // Les produits avec photo d'abord, puis par écart de prix.
  return list
    .sort((a, b) => Number(!!b.image_url) - Number(!!a.image_url) || Math.abs(a.price_cents - p.price_cents) - Math.abs(b.price_cents - p.price_cents))
    .slice(0, 12);
}
