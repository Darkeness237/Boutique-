const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function formatPrice(cents: number): string {
  return euro.format(cents / 100);
}

export function stockLabel(inStock: boolean, leadDays: number): { text: string; short: string; tone: "ok" | "out" } {
  if (!inStock) return { text: "Sur commande, nous consulter", short: "Sur commande", tone: "out" };
  const delay = leadDays <= 1 ? "expédié sous 24 h" : `expédié sous ${leadDays} jours ouvrés`;
  return { text: `En stock, ${delay}`, short: "En stock", tone: "ok" };
}
