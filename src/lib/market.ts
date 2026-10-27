import { activePromo, effectivePrice, type Product } from "./product";

// Deux marchés : la France (prix en euros, TTC) et le Cameroun (prix en FCFA, livrés,
// transport, dédouanement et TVA camerounaise compris). Le marché est choisi par cookie.
export type Market = "fr" | "cm";
export const MARKET_COOKIE = "marche";

export const MARKETS: Record<Market, { label: string; country: string; currency: "EUR" | "XAF" }> = {
  fr: { label: "France", country: "France", currency: "EUR" },
  cm: { label: "Cameroun", country: "Cameroun", currency: "XAF" },
};

export function parseMarket(value: string | undefined | null): Market {
  return value === "cm" ? "cm" : "fr";
}

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const xaf = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XAF", maximumFractionDigits: 0 });

/** Montant dans l'unité du marché : centimes d'euro en France, francs CFA au Cameroun. */
export function formatMoney(market: Market, amount: number): string {
  return market === "cm" ? xaf.format(amount) : eur.format(amount / 100);
}

/** Le produit peut-il être vendu sur ce marché ? (au Cameroun : uniquement s'il a un prix livré) */
export function isAvailableIn(p: Pick<Product, "price_xaf">, market: Market): boolean {
  return market === "fr" || p.price_xaf !== null;
}

/** Prix unitaire payé sur ce marché. Les promotions ne concernent que la France pour l'instant. */
export function unitPrice(p: Product, market: Market): number {
  return market === "cm" ? (p.price_xaf ?? 0) : effectivePrice(p);
}

export function promoFor(p: Product, market: Market) {
  return market === "fr" ? activePromo(p) : null;
}

export function priceNote(market: Market, vatNote: string): string {
  return market === "cm" ? "Prix livré : transport, dédouanement et TVA camerounaise compris" : vatNote;
}
