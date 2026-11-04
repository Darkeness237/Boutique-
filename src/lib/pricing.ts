// Vocabulaire du module pricing (admin).

export const PRICING_STATUS = {
  tres_competitif: { icon: "🔥", label: "Très compétitif" },
  bien: { icon: "✅", label: "Bien positionné" },
  trop_cher: { icon: "⚠️", label: "Trop cher" },
  marge_insuffisante: { icon: "📉", label: "Marge insuffisante" },
  sans_donnees: { icon: "—", label: "Sans données marché" },
} as const;
export type PricingStatus = keyof typeof PRICING_STATUS;

export const DECISIONS = {
  aucune: "Rien à faire",
  auto: "Automatique",
  a_valider: "À valider",
  applique: "Appliqué",
  refuse: "Refusé",
  verrouille: "Prix verrouillé",
} as const;
export type Decision = keyof typeof DECISIONS;

export const ALERT_KINDS = {
  concurrent_moins_cher: "Concurrent moins cher",
  promo_fournisseur: "Nouvelle promo 1foTrade",
  fin_promo_fournisseur: "Fin de promo 1foTrade",
  marge_faible: "Marge trop faible",
  rupture_fournisseur: "Rupture fournisseur",
  a_valider: "Prix à valider",
} as const;

export type Suggestion = {
  product_id: number;
  cost_real_cents: number;
  floor_cents: number;
  market_min_cents: number | null;
  market_avg_cents: number | null;
  market_max_cents: number | null;
  market_count: number;
  cheapest_competitor_id: number | null;
  current_cents: number;
  suggested_cents: number;
  margin_cents: number;
  margin_pct: number;
  rank: number | null;
  status: PricingStatus;
  decision: Decision;
  computed_at: string;
  products: { name: string; brand: string; slug: string; category_slug: string; in_stock: boolean } | null;
};
export const SUGGESTION_COLUMNS =
  "product_id, cost_real_cents, floor_cents, market_min_cents, market_avg_cents, market_max_cents, market_count, cheapest_competitor_id, current_cents, suggested_cents, margin_cents, margin_pct, rank, status, decision, computed_at, products(name, brand, slug, category_slug, in_stock)";

export type Competitor = { id: number; name: string; domain: string; collect: boolean; active: boolean; last_status: string | null; last_checked_at: string | null };

const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
export const euros = (cents: number | null | undefined) => (cents == null ? "—" : eur.format(cents / 100));
export const pct = (v: number | null | undefined) => (v == null ? "—" : `${Number(v).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`);

/** Lit un montant saisi en euros (« 149,90 ») et le renvoie en centimes, ou null. */
export function parseEuros(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim().replace(/\s|€/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) : null;
}
