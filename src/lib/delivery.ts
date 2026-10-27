// Fenêtre de livraison estimée : délai d'expédition du fournisseur + 1 à 3 jours ouvrés de transport.
// C'est une estimation affichée comme telle, jamais une promesse de date.
const TRANSIT_MIN = 1;
const TRANSIT_MAX = 3;

function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return d;
}

const fmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });

export function deliveryWindow(leadDays: number, now = new Date()): { from: string; to: string } {
  return {
    from: fmt.format(addBusinessDays(now, leadDays + TRANSIT_MIN)),
    to: fmt.format(addBusinessDays(now, leadDays + TRANSIT_MAX)),
  };
}

/** Fenêtre de livraison à partir d'un nombre de jours ouvrés minimum et maximum (Cameroun). */
export function deliveryRange(minDays: number, maxDays: number, now = new Date()): { from: string; to: string } {
  return { from: fmt.format(addBusinessDays(now, minDays)), to: fmt.format(addBusinessDays(now, maxDays)) };
}
