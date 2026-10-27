import type { Product } from "./product";

export type Check = { label: string; ok: boolean; detail: string };

/** Marge recommandée entre la consommation estimée et la puissance de l'alimentation. */
export const PSU_HEADROOM = 1.3;
/** Consommation forfaitaire du reste de la config (carte mère, SSD, ventilateurs). */
const BASE_WATTS = 75;

// Consommations typiques (constructeurs) : le fichier fournisseur ne les donne pas.
const GPU_WATTS: [RegExp, number][] = [
  [/RTX 5090/i, 575], [/RTX 5080/i, 360], [/RTX 5070 Ti/i, 300], [/RTX 5070/i, 250],
  [/RTX 5060 Ti/i, 180], [/RTX 5060/i, 145], [/RTX 5050/i, 130],
  [/RTX 40[89]0/i, 400], [/RTX 4070/i, 220], [/RTX 4060/i, 160], [/RTX 30[89]0/i, 350], [/RTX 30[67]0/i, 200],
  [/RX 9070 XT/i, 304], [/RX 9070/i, 220], [/RX 9060 XT/i, 160], [/RX 7[89]00/i, 300], [/RX 7[67]00/i, 230],
  [/Arc B5[78]0/i, 190],
];

export function estimatedPartWatts(p: Pick<Product, "category_slug" | "name">): number {
  if (p.category_slug === "cartes-graphiques") {
    return GPU_WATTS.find(([re]) => re.test(p.name))?.[1] ?? 250;
  }
  if (p.category_slug === "processeurs") {
    if (/Ryzen 9|Core (Ultra )?9/i.test(p.name)) return 170;
    if (/\d{4,5}X3D|\d{4}X\b|\d{3,5}K/i.test(p.name)) return 120;
    return 65;
  }
  return 0;
}

export function estimatedWatts(parts: Pick<Product, "category_slug" | "name">[]): number {
  return parts.reduce((sum, p) => sum + estimatedPartWatts(p), BASE_WATTS);
}

/** Puissance d'alimentation conseillée, arrondie aux 50 W supérieurs. */
export function recommendedPsuWatts(parts: Pick<Product, "category_slug" | "name">[]): number {
  return Math.ceil((estimatedWatts(parts) * PSU_HEADROOM) / 50) * 50;
}

/** Vérifie qu'un ensemble de pièces fonctionne ensemble. */
export function checkBuild(parts: Product[]): Check[] {
  const find = (slug: string) => parts.find((p) => p.category_slug === slug);
  const cpu = find("processeurs");
  const board = find("cartes-meres");
  const ram = find("memoire");
  const psu = find("alimentations");
  const checks: Check[] = [];

  if (cpu?.socket && board?.socket) {
    const ok = cpu.socket === board.socket;
    checks.push({ label: "Socket", ok, detail: ok ? `${cpu.socket} des deux côtés` : `${cpu.socket} ≠ ${board.socket}` });
  }
  if (ram?.memory && board?.memory) {
    const ok = ram.memory === board.memory;
    checks.push({
      label: "Mémoire",
      ok,
      detail: ok ? `${ram.memory} acceptée par la carte mère` : `${ram.memory} ≠ ${board.memory}`,
    });
  }
  if (psu?.psu_watts) {
    const draw = estimatedWatts(parts);
    const ok = psu.psu_watts >= draw * PSU_HEADROOM;
    checks.push({ label: "Alimentation", ok, detail: `${draw} W estimés pour ${psu.psu_watts} W disponibles` });
  }
  return checks;
}
