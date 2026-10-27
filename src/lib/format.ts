const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function formatPrice(cents: number): string {
  return euro.format(cents / 100);
}

export function stockLabel(stock: number): { text: string; tone: "ok" | "low" | "out" } {
  if (stock <= 0) return { text: "En rupture", tone: "out" };
  if (stock <= 5) return { text: `Plus que ${stock} en stock`, tone: "low" };
  return { text: "En stock, expédié sous 24 h", tone: "ok" };
}
