import type { Product } from "./catalog";

export type Check = { label: string; ok: boolean; detail: string };

/** Marge recommandée entre la consommation estimée et la puissance de l'alimentation. */
const PSU_HEADROOM = 1.3;
/** Consommation forfaitaire du reste de la config (carte mère, SSD, ventilateurs). */
const BASE_WATTS = 75;

/**
 * Vérifie qu'un ensemble de pièces fonctionne ensemble.
 * Sert au panneau d'accueil et servira au futur configurateur.
 */
export function checkBuild(parts: Product[]): Check[] {
  const cpu = parts.find((p) => p.category === "processeurs");
  const board = parts.find((p) => p.category === "cartes-meres");
  const ram = parts.find((p) => p.category === "memoire");
  const gpu = parts.find((p) => p.category === "cartes-graphiques");
  const psu = parts.find((p) => p.category === "alimentations");
  const checks: Check[] = [];

  if (cpu && board) {
    const ok = cpu.socket === board.socket;
    checks.push({
      label: "Socket",
      ok,
      detail: ok ? `${cpu.socket} des deux côtés` : `${cpu.socket} ≠ ${board.socket}`,
    });
  }
  if (ram && board) {
    const ok = ram.memory === board.memory;
    checks.push({
      label: "Mémoire",
      ok,
      detail: ok ? `${ram.memory} acceptée par la carte mère` : `${ram.memory} ≠ ${board.memory}`,
    });
  }
  if (psu) {
    const draw = estimatedWatts(parts);
    const ok = (psu.psuWatts ?? 0) >= draw * PSU_HEADROOM;
    checks.push({
      label: "Alimentation",
      ok,
      detail: `${draw} W estimés pour ${psu.psuWatts} W disponibles`,
    });
  }
  return checks;
}

export function estimatedWatts(parts: Product[]): number {
  return parts.reduce((sum, p) => sum + (p.watts ?? 0), BASE_WATTS);
}
