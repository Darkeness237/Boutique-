import { z } from "zod";
import { getProductById, type Product } from "./catalog";

export const MAX_QTY = 10;
const MAX_LINES = 50;

// Le panier stocké dans le navigateur ne contient que des identifiants et des quantités.
// Le prix vient TOUJOURS du catalogue (et, au paiement, du serveur) : un panier modifié
// à la main ne peut pas changer ce que paie le client.
export const cartSchema = z
  .array(
    z.object({
      id: z.string().max(64),
      qty: z.number().int().min(1).max(MAX_QTY),
    }),
  )
  .max(MAX_LINES);

export type CartLine = z.infer<typeof cartSchema>[number];

export type PricedLine = { product: Product; qty: number; totalCents: number };

export function parseCart(raw: unknown): CartLine[] {
  const parsed = cartSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export function priceCart(lines: CartLine[]): { lines: PricedLine[]; subtotalCents: number } {
  const priced: PricedLine[] = [];
  for (const line of lines) {
    const product = getProductById(line.id);
    if (!product) continue;
    priced.push({ product, qty: line.qty, totalCents: product.priceCents * line.qty });
  }
  return { lines: priced, subtotalCents: priced.reduce((s, l) => s + l.totalCents, 0) };
}

export const FREE_SHIPPING_CENTS = 9900;
export const SHIPPING_CENTS = 690;
