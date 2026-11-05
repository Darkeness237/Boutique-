// Commandes côté administration : libellés, types et formatage partagés par la liste et le détail.

export const ORDER_STATUS = {
  payee: { label: "À commander chez le fournisseur", tone: "warn" },
  commandee_fournisseur: { label: "Commandée chez le fournisseur", tone: "info" },
  expediee: { label: "Expédiée", tone: "info" },
  livree: { label: "Livrée", tone: "ok" },
  annulee: { label: "Annulée", tone: "muted" },
  remboursee: { label: "Remboursée", tone: "muted" },
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS;
export const isOrderStatus = (s: string): s is OrderStatus => s in ORDER_STATUS;

export type AdminOrderRow = {
  id: string;
  number: string;
  created_at: string;
  status: OrderStatus;
  market: "fr" | "cm";
  currency: "eur" | "xaf";
  total: number;
  customer_name: string | null;
  email: string;
  items: number;
  cost: number;
  seen: boolean;
};

export type AdminOrderLine = {
  product_id: number | null;
  name: string;
  ean: string | null;
  qty: number;
  unit_price: number;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_sku: string | null;
  supplier_cost_cents: number | null;
  slug: string | null;
};

export type AdminOrder = Omit<AdminOrderRow, "items" | "cost" | "seen"> & {
  subtotal: number;
  shipping: number;
  phone: string | null;
  shipping_address: Record<string, string | null> | null;
  stripe_payment_intent: string | null;
  tracking: string | null;
  carrier: string | null;
  supplier_order_ref: string | null;
  admin_note: string | null;
  status_changed_at: string | null;
  supplier_vat: "ttc" | "ht_export";
  lines: AdminOrderLine[];
};

export function money(amount: number, currency: "eur" | "xaf"): string {
  return currency === "xaf"
    ? `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`
    : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount / 100);
}

/** Adresse sur plusieurs lignes, prête à copier dans le formulaire du fournisseur. */
export function addressLines(o: Pick<AdminOrder, "customer_name" | "shipping_address" | "phone">): string[] {
  const a = o.shipping_address ?? {};
  const pick = (...keys: string[]) => keys.map((k) => a[k]).find((v) => v && String(v).trim()) ?? "";
  return [
    o.customer_name ?? pick("name"),
    pick("line1", "address1"),
    pick("line2", "address2"),
    [pick("postal_code", "postalCode"), pick("city")].filter(Boolean).join(" "),
    pick("country") || "France",
    o.phone ? `Tél. ${o.phone}` : "",
  ].filter((l) => l && l.trim());
}

/** Liens de suivi des transporteurs courants (le numéro seul reste affiché sinon). */
export function trackingUrl(carrier: string | null, tracking: string | null): string | null {
  if (!tracking) return null;
  const t = encodeURIComponent(tracking);
  const c = (carrier ?? "").toLowerCase();
  if (c.includes("colissimo") || c.includes("poste")) return `https://www.laposte.fr/outils/suivre-vos-envois?code=${t}`;
  if (c.includes("chrono")) return `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLV=${t}`;
  if (c.includes("dpd")) return `https://trace.dpd.fr/fr/trace/${t}`;
  if (c.includes("gls")) return `https://gls-group.com/FR/fr/suivi-colis?match=${t}`;
  if (c.includes("ups")) return `https://www.ups.com/track?tracknum=${t}`;
  if (c.includes("dhl")) return `https://www.dhl.com/fr-fr/home/suivi.html?tracking-id=${t}`;
  return null;
}
