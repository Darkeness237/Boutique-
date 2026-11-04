import { inStock, type Product } from "./catalog";
import { recommendedPsuWatts } from "./compat";
import type { Market } from "./market";

// Configs complètes prêtes à commander, composées à partir du stock réel. Une config se compare mal pièce par
// pièce avec les grandes enseignes : sa valeur, c'est la compatibilité vérifiée et un PC complet en un clic.

const CERTIFIED_PSU = /80 ?(\+|plus)|\b(bronze|gold|platinum|titanium)\b/i;
const NO_IGPU = /sans igpu|\b\d{4,5}F\b|\bKF\b/i;

export type Tier = {
  slug: string;
  title: string;
  pitch: string;
  usage: string[];
  cpu: { min: number; max: number; needsIgpu?: boolean };
  gpu: string[] | null;
  ram: string[];
  ssd: string[];
};

export const TIERS: Tier[] = [
  {
    slug: "bureautique",
    title: "Bureautique et études",
    pitch: "Rapide et silencieux, sans carte graphique : le processeur s'occupe de l'affichage.",
    usage: ["Bureautique, navigation, visio", "Études, programmation", "Retouche photo légère"],
    cpu: { min: 15000, max: 22000, needsIgpu: true },
    gpu: null,
    ram: ["16Go", "16 Go"],
    ssd: ["1To", "1 To", "500Go", "512Go"],
  },
  {
    slug: "gaming-1080p",
    title: "Gaming 1080p",
    pitch: "Les jeux récents en Full HD, réglages élevés, à plus de 60 images par seconde.",
    usage: ["Fortnite, Valorant, CS2 à plus de 144 i/s", "Jeux AAA en 1080p élevé", "Streaming"],
    cpu: { min: 12000, max: 20000 },
    gpu: ["RTX 5060", "RX 9060"],
    // 16 Go suffisent en 1080p ; la DDR5 32 Go coûte aujourd'hui plus cher que la carte graphique.
    ram: ["16Go", "16 Go"],
    ssd: ["1To", "1 To"],
  },
  {
    slug: "gaming-1440p",
    title: "Gaming 1440p",
    pitch: "La qualité QHD avec de la marge pour les années à venir.",
    usage: ["Jeux AAA en 1440p ultra", "Création vidéo", "Streaming en haute qualité"],
    cpu: { min: 18000, max: 32000 },
    gpu: ["RTX 5070", "RX 9070"],
    ram: ["32Go", "32 Go"],
    ssd: ["2To", "2 To", "1To", "1 To"],
  },
];

export type Build = { tier: Tier; parts: Product[] };

function middle<T>(list: T[]): T | undefined {
  return list[Math.floor(list.length / 2)];
}

export async function composeTier(tier: Tier, market: Market = "fr"): Promise<Build | null> {
  for (const socket of ["AM5", "LGA1851"]) {
    const cpus = (await inStock("processeurs", { socket, minPriceCents: tier.cpu.min, maxPriceCents: tier.cpu.max, market })).filter(
      (p) => !tier.cpu.needsIgpu || !NO_IGPU.test(p.name),
    );
    const cpu = middle(cpus);
    if (!cpu) continue;

    const board = (await inStock("cartes-meres", { socket, memory: "DDR5", minPriceCents: 9000, market }))[0];
    const ram = (await inStock("memoire", { memory: "DDR5", nameMatches: tier.ram, market })).find((p) => /2 ?x/i.test(p.name));
    const gpu = tier.gpu ? (await inStock("cartes-graphiques", { nameMatches: tier.gpu, market }))[0] : undefined;
    if (!board || !ram || (tier.gpu && !gpu)) continue;

    const ssd = (await inStock("stockage", { subcategory: "ssd-nvme", nameMatches: tier.ssd, minPriceCents: 4000, market }))[0];
    // Processeurs en version boîte ou OEM : un ventirad correct est toujours ajouté (plus silencieux que l'origine).
    const cooler = middle(await inStock("refroidissement", { subcategory: "ventirads", minPriceCents: 2500, maxPriceCents: 6000, withImage: true, market }));
    const pcCase = middle(await inStock("boitiers", { subcategory: "moyen-tour", minPriceCents: 5000, maxPriceCents: tier.gpu ? 12000 : 8000, withImage: true, market }));
    const core = [cpu, board, ram, ...(gpu ? [gpu] : [])];
    const needed = Math.max(450, recommendedPsuWatts(core));
    const psu = (await inStock("alimentations", { minPsuWatts: needed, minPriceCents: 5000, market })).find(
      (p) => (p.psu_watts ?? 0) <= needed + 250 && CERTIFIED_PSU.test(p.name),
    );
    if (!ssd || !cooler || !pcCase || !psu) continue;
    return { tier, parts: [...core, ssd, cooler, psu, pcCase] };
  }
  return null;
}

export async function composeTiers(market: Market = "fr"): Promise<Build[]> {
  const builds = await Promise.all(TIERS.map((t) => composeTier(t, market)));
  return builds.filter((b): b is Build => b !== null);
}
