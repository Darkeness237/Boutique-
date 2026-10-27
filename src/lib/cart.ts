import { z } from "zod";
import type { Product } from "./product";

export const MAX_QTY = 10;
const MAX_LINES = 50;

// Le panier stocké dans le navigateur ne contient que des identifiants et des quantités.
// Le prix vient TOUJOURS de la base (et, au paiement, du serveur) : un panier modifié
// à la main ne peut pas changer ce que paie le client.
export const cartSchema = z
  .array(
    z.object({
      id: z.string().regex(/^\d{1,12}$/),
      qty: z.number().int().min(1).max(MAX_QTY),
    }),
  )
  .max(MAX_LINES);

export type CartLine = z.infer<typeof cartSchema>[number];

export type PricedLine = { product: Product; qty: number; totalCents: number };

export function parseCart(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  // Une ligne invalide (ancien format, valeur bricolée) est ignorée sans vider tout le panier.
  return raw.flatMap((line) => {
    const parsed = cartSchema.element.safeParse(line);
    return parsed.success ? [parsed.data] : [];
  }).slice(0, MAX_LINES);
}

export function priceCart(lines: CartLine[], products: Product[]): { lines: PricedLine[]; subtotalCents: number } {
  const byId = new Map(products.map((p) => [String(p.id), p]));
  const priced: PricedLine[] = [];
  for (const line of lines) {
    const product = byId.get(line.id);
    if (!product) continue;
    priced.push({ product, qty: line.qty, totalCents: product.price_cents * line.qty });
  }
  return { lines: priced, subtotalCents: priced.reduce((s, l) => s + l.totalCents, 0) };
}

export const FREE_SHIPPING_CENTS = 9900;
export const SHIPPING_CENTS = 690;
