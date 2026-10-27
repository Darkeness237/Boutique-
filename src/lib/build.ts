import { inStock, type Product } from "./catalog";
import { recommendedPsuWatts } from "./compat";
import type { Market } from "./market";

const CERTIFIED_PSU = /80 ?(\+|plus)|\b(bronze|gold|platinum|titanium)\b/i;

/**
 * Compose automatiquement la « config du moment » à partir du stock réel :
 * un processeur milieu de gamme, une carte mère et une mémoire compatibles,
 * une carte graphique 1440p et une alimentation suffisante, toutes disponibles.
 */
export async function pickBuild(market: Market = "fr"): Promise<Product[] | null> {
  for (const socket of ["AM5", "LGA1851"]) {
    const cpus = await inStock("processeurs", { socket, minPriceCents: 20000, market });
    const cpu = cpus.find((p) => /X3D/.test(p.name)) ?? middle(cpus);
    if (!cpu) continue;

    const board = (await inStock("cartes-meres", { socket, memory: "DDR5", market }))[0];
    if (!board) continue;

    const ram = (await inStock("memoire", { memory: "DDR5", nameMatches: ["32Go", "32 Go"], market })).find((p) =>
      /2 ?x/i.test(p.name),
    );
    const gpu = (await inStock("cartes-graphiques", { nameMatches: ["RTX 5060", "RTX 5070", "RX 9060", "RX 9070"], market }))[0];
    if (!ram || !gpu) continue;

    const needed = recommendedPsuWatts([cpu, gpu]);
    // Une config recommandée mérite une alimentation certifiée, pas un premier prix.
    const psu = (await inStock("alimentations", { minPsuWatts: needed, minPriceCents: 6000, market })).find(
      (p) => (p.psu_watts ?? 0) <= needed + 300 && CERTIFIED_PSU.test(p.name),
    );
    if (!psu) continue;

    return [cpu, board, ram, gpu, psu];
  }
  return null;
}

function middle<T>(list: T[]): T | undefined {
  return list[Math.floor(list.length / 2)];
}
