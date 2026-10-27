// Catalogue de démonstration. Il sera remplacé par la table `products` de Supabase :
// garder la même forme de données permettra de brancher la base sans toucher aux pages.
// Les prix sont indicatifs et stockés en centimes pour éviter les erreurs d'arrondi.

export type CategorySlug =
  | "processeurs"
  | "cartes-meres"
  | "cartes-graphiques"
  | "memoire"
  | "stockage"
  | "alimentations"
  | "boitiers"
  | "refroidissement"
  | "peripheriques";

export type Category = {
  slug: CategorySlug;
  name: string;
  /** Une phrase qui aide à choisir, pas un slogan. */
  hint: string;
};

export type Socket = "AM5" | "LGA1851";
export type MemoryType = "DDR5";

export type Product = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: CategorySlug;
  priceCents: number;
  stock: number;
  /** La caractéristique qui compte le plus pour ce type de pièce. */
  keySpec: string;
  description: string;
  specs: [label: string, value: string][];
  socket?: Socket;
  memory?: MemoryType;
  /** Consommation typique en watts (processeurs et cartes graphiques). */
  watts?: number;
  /** Puissance délivrée en watts (alimentations). */
  psuWatts?: number;
};

export const categories: Category[] = [
  { slug: "processeurs", name: "Processeurs", hint: "Le socket décide de la carte mère." },
  { slug: "cartes-meres", name: "Cartes mères", hint: "Socket, format et type de mémoire." },
  { slug: "cartes-graphiques", name: "Cartes graphiques", hint: "Ce qui fait les images par seconde." },
  { slug: "memoire", name: "Mémoire", hint: "32 Go en DDR5 suffisent pour jouer." },
  { slug: "stockage", name: "Stockage", hint: "SSD NVMe pour des chargements courts." },
  { slug: "alimentations", name: "Alimentations", hint: "Prévoir une marge de 30 % sur la conso." },
  { slug: "boitiers", name: "Boîtiers", hint: "Flux d'air, format, longueur de carte graphique." },
  { slug: "refroidissement", name: "Refroidissement", hint: "Ventirad ou watercooling AIO." },
  { slug: "peripheriques", name: "Périphériques", hint: "Souris, claviers, casques." },
];

export const products: Product[] = [
  {
    id: "cpu-9800x3d",
    slug: "amd-ryzen-7-9800x3d",
    name: "Ryzen 7 9800X3D",
    brand: "AMD",
    category: "processeurs",
    priceCents: 47900,
    stock: 14,
    keySpec: "8 cœurs · 3D V-Cache",
    description:
      "Le processeur de référence pour le jeu : son cache 3D de 96 Mo réduit les baisses d'images dans les scènes chargées.",
    specs: [
      ["Socket", "AM5"],
      ["Cœurs / threads", "8 / 16"],
      ["Fréquence boost", "5,2 GHz"],
      ["Cache L3", "96 Mo"],
      ["TDP", "120 W"],
      ["Ventirad fourni", "Non"],
    ],
    socket: "AM5",
    watts: 120,
  },
  {
    id: "cpu-9600x",
    slug: "amd-ryzen-5-9600x",
    name: "Ryzen 5 9600X",
    brand: "AMD",
    category: "processeurs",
    priceCents: 22900,
    stock: 22,
    keySpec: "6 cœurs · 5,4 GHz",
    description: "Six cœurs rapides et une consommation contenue : la bonne base pour une config 1080p ou 1440p.",
    specs: [
      ["Socket", "AM5"],
      ["Cœurs / threads", "6 / 12"],
      ["Fréquence boost", "5,4 GHz"],
      ["Cache L3", "32 Mo"],
      ["TDP", "65 W"],
      ["Ventirad fourni", "Non"],
    ],
    socket: "AM5",
    watts: 65,
  },
  {
    id: "cpu-265k",
    slug: "intel-core-ultra-7-265k",
    name: "Core Ultra 7 265K",
    brand: "Intel",
    category: "processeurs",
    priceCents: 33900,
    stock: 3,
    keySpec: "20 cœurs · 5,5 GHz",
    description: "Beaucoup de cœurs pour jouer et streamer, ou monter de la vidéo, sur la même machine.",
    specs: [
      ["Socket", "LGA1851"],
      ["Cœurs / threads", "20 / 20"],
      ["Fréquence boost", "5,5 GHz"],
      ["Cache L3", "30 Mo"],
      ["TDP", "125 W"],
      ["Ventirad fourni", "Non"],
    ],
    socket: "LGA1851",
    watts: 125,
  },
  {
    id: "mb-b850f",
    slug: "asus-rog-strix-b850-f-gaming-wifi",
    name: "ROG Strix B850-F Gaming WiFi",
    brand: "ASUS",
    category: "cartes-meres",
    priceCents: 29900,
    stock: 9,
    keySpec: "AM5 · ATX · Wi-Fi 7",
    description: "Une carte AM5 complète : PCIe 5.0 pour la carte graphique et le SSD, Wi-Fi 7 et 4 emplacements M.2.",
    specs: [
      ["Socket", "AM5"],
      ["Chipset", "B850"],
      ["Format", "ATX"],
      ["Mémoire", "DDR5, 4 emplacements, 192 Go max"],
      ["M.2", "4 emplacements"],
      ["Réseau", "Wi-Fi 7, 2,5 Gb Ethernet"],
    ],
    socket: "AM5",
    memory: "DDR5",
  },
  {
    id: "mb-b650-tomahawk",
    slug: "msi-mag-b650-tomahawk-wifi",
    name: "MAG B650 Tomahawk WiFi",
    brand: "MSI",
    category: "cartes-meres",
    priceCents: 19900,
    stock: 17,
    keySpec: "AM5 · ATX · Wi-Fi 6E",
    description: "Robuste et bien refroidie, l'option raisonnable pour un Ryzen sans payer le PCIe 5.0.",
    specs: [
      ["Socket", "AM5"],
      ["Chipset", "B650"],
      ["Format", "ATX"],
      ["Mémoire", "DDR5, 4 emplacements, 192 Go max"],
      ["M.2", "3 emplacements"],
      ["Réseau", "Wi-Fi 6E, 2,5 Gb Ethernet"],
    ],
    socket: "AM5",
    memory: "DDR5",
  },
  {
    id: "mb-z890-elite",
    slug: "gigabyte-z890-aorus-elite-wifi7",
    name: "Z890 Aorus Elite WiFi7",
    brand: "Gigabyte",
    category: "cartes-meres",
    priceCents: 28900,
    stock: 6,
    keySpec: "LGA1851 · ATX · Wi-Fi 7",
    description: "Pour les Core Ultra de 2e génération, avec overclocking et Thunderbolt en option.",
    specs: [
      ["Socket", "LGA1851"],
      ["Chipset", "Z890"],
      ["Format", "ATX"],
      ["Mémoire", "DDR5, 4 emplacements, 256 Go max"],
      ["M.2", "4 emplacements"],
      ["Réseau", "Wi-Fi 7, 2,5 Gb Ethernet"],
    ],
    socket: "LGA1851",
    memory: "DDR5",
  },
  {
    id: "gpu-5070",
    slug: "msi-geforce-rtx-5070-ventus-2x-oc",
    name: "GeForce RTX 5070 Ventus 2X OC",
    brand: "MSI",
    category: "cartes-graphiques",
    priceCents: 59900,
    stock: 11,
    keySpec: "12 Go GDDR7 · 1440p",
    description: "Le 1440p à haute fréquence dans les jeux récents, DLSS 4 compris. Compacte : 24 cm de long.",
    specs: [
      ["Mémoire", "12 Go GDDR7"],
      ["Interface", "PCIe 5.0 x16"],
      ["Longueur", "242 mm"],
      ["Consommation", "250 W"],
      ["Connecteur", "1 × 16 broches"],
      ["Sorties", "3 × DisplayPort 2.1, 1 × HDMI 2.1"],
    ],
    watts: 250,
  },
  {
    id: "gpu-5080",
    slug: "gigabyte-geforce-rtx-5080-gaming-oc",
    name: "GeForce RTX 5080 Gaming OC",
    brand: "Gigabyte",
    category: "cartes-graphiques",
    priceCents: 119900,
    stock: 4,
    keySpec: "16 Go GDDR7 · 4K",
    description: "Pour jouer en 4K avec le ray tracing activé. Vérifiez la longueur : 34 cm.",
    specs: [
      ["Mémoire", "16 Go GDDR7"],
      ["Interface", "PCIe 5.0 x16"],
      ["Longueur", "340 mm"],
      ["Consommation", "360 W"],
      ["Connecteur", "1 × 16 broches"],
      ["Sorties", "3 × DisplayPort 2.1, 1 × HDMI 2.1"],
    ],
    watts: 360,
  },
  {
    id: "gpu-9070xt",
    slug: "sapphire-pulse-radeon-rx-9070-xt",
    name: "Pulse Radeon RX 9070 XT",
    brand: "Sapphire",
    category: "cartes-graphiques",
    priceCents: 64900,
    stock: 0,
    keySpec: "16 Go GDDR6 · 1440p",
    description: "16 Go de mémoire vidéo et de très bonnes performances en 1440p, avec FSR 4.",
    specs: [
      ["Mémoire", "16 Go GDDR6"],
      ["Interface", "PCIe 5.0 x16"],
      ["Longueur", "280 mm"],
      ["Consommation", "304 W"],
      ["Connecteur", "2 × 8 broches"],
      ["Sorties", "2 × DisplayPort 2.1, 2 × HDMI 2.1"],
    ],
    watts: 304,
  },
  {
    id: "ram-vengeance-32",
    slug: "corsair-vengeance-ddr5-32-go-6000",
    name: "Vengeance DDR5 32 Go (2 × 16) 6000 MHz CL30",
    brand: "Corsair",
    category: "memoire",
    priceCents: 11900,
    stock: 40,
    keySpec: "32 Go · 6000 MHz CL30",
    description: "Le kit le plus équilibré pour un Ryzen 9000 : 6000 MHz est sa fréquence idéale.",
    specs: [
      ["Type", "DDR5"],
      ["Capacité", "32 Go (2 × 16 Go)"],
      ["Fréquence", "6000 MHz"],
      ["Latence", "CL30"],
      ["Profils", "AMD EXPO, Intel XMP 3.0"],
    ],
    memory: "DDR5",
  },
  {
    id: "ram-tridentz5-64",
    slug: "gskill-trident-z5-rgb-ddr5-64-go-6400",
    name: "Trident Z5 RGB DDR5 64 Go (2 × 32) 6400 MHz CL32",
    brand: "G.Skill",
    category: "memoire",
    priceCents: 22900,
    stock: 8,
    keySpec: "64 Go · 6400 MHz CL32",
    description: "64 Go pour le montage vidéo, la 3D ou beaucoup d'onglets ouverts pendant une partie.",
    specs: [
      ["Type", "DDR5"],
      ["Capacité", "64 Go (2 × 32 Go)"],
      ["Fréquence", "6400 MHz"],
      ["Latence", "CL32"],
      ["Profils", "Intel XMP 3.0"],
    ],
    memory: "DDR5",
  },
  {
    id: "ssd-990pro-2t",
    slug: "samsung-990-pro-2-to",
    name: "990 Pro 2 To",
    brand: "Samsung",
    category: "stockage",
    priceCents: 16900,
    stock: 25,
    keySpec: "2 To · 7450 Mo/s",
    description: "De la place pour une trentaine de jeux récents et parmi les SSD PCIe 4.0 les plus rapides.",
    specs: [
      ["Format", "M.2 2280"],
      ["Interface", "PCIe 4.0 x4 NVMe"],
      ["Lecture", "7450 Mo/s"],
      ["Écriture", "6900 Mo/s"],
      ["Garantie constructeur", "5 ans"],
    ],
  },
  {
    id: "ssd-sn850x-1t",
    slug: "wd-black-sn850x-1-to",
    name: "WD_Black SN850X 1 To",
    brand: "WD",
    category: "stockage",
    priceCents: 8900,
    stock: 31,
    keySpec: "1 To · 7300 Mo/s",
    description: "Un SSD rapide à prix sage, compatible PlayStation 5.",
    specs: [
      ["Format", "M.2 2280"],
      ["Interface", "PCIe 4.0 x4 NVMe"],
      ["Lecture", "7300 Mo/s"],
      ["Écriture", "6300 Mo/s"],
      ["Garantie constructeur", "5 ans"],
    ],
  },
  {
    id: "psu-rm850x",
    slug: "corsair-rm850x-2024",
    name: "RM850x (2024)",
    brand: "Corsair",
    category: "alimentations",
    priceCents: 13900,
    stock: 18,
    keySpec: "850 W · 80+ Gold · ATX 3.1",
    description: "Silencieuse, entièrement modulaire, avec le câble 16 broches natif des cartes graphiques récentes.",
    specs: [
      ["Puissance", "850 W"],
      ["Certification", "80 PLUS Gold"],
      ["Norme", "ATX 3.1, PCIe 5.1"],
      ["Modulaire", "Oui, entièrement"],
      ["Garantie constructeur", "10 ans"],
    ],
    psuWatts: 850,
  },
  {
    id: "psu-pp12m-750",
    slug: "be-quiet-pure-power-12-m-750w",
    name: "Pure Power 12 M 750 W",
    brand: "be quiet!",
    category: "alimentations",
    priceCents: 10900,
    stock: 12,
    keySpec: "750 W · 80+ Gold · ATX 3.1",
    description: "Assez pour une RTX 5070 et un Ryzen 7, avec un ventilateur très discret.",
    specs: [
      ["Puissance", "750 W"],
      ["Certification", "80 PLUS Gold"],
      ["Norme", "ATX 3.1"],
      ["Modulaire", "Oui, entièrement"],
      ["Garantie constructeur", "10 ans"],
    ],
    psuWatts: 750,
  },
  {
    id: "case-north",
    slug: "fractal-design-north",
    name: "North",
    brand: "Fractal Design",
    category: "boitiers",
    priceCents: 14900,
    stock: 7,
    keySpec: "ATX · façade bois",
    description: "Une façade en noyer et un très bon flux d'air : un PC qui a sa place dans un salon.",
    specs: [
      ["Format", "Moyen tour, ATX"],
      ["Carte graphique max", "355 mm"],
      ["Ventirad max", "170 mm"],
      ["Radiateur", "Jusqu'à 360 mm"],
      ["Ventilateurs inclus", "2 × 140 mm"],
    ],
  },
  {
    id: "case-o11evo",
    slug: "lian-li-o11-dynamic-evo",
    name: "O11 Dynamic EVO",
    brand: "Lian Li",
    category: "boitiers",
    priceCents: 15900,
    stock: 5,
    keySpec: "ATX · double vitre",
    description: "Deux faces vitrées pour montrer la config, et la place pour trois radiateurs.",
    specs: [
      ["Format", "Moyen tour, ATX"],
      ["Carte graphique max", "422 mm"],
      ["Ventirad max", "167 mm"],
      ["Radiateur", "Jusqu'à 3 × 360 mm"],
      ["Ventilateurs inclus", "Aucun"],
    ],
  },
  {
    id: "cool-nhd15g2",
    slug: "noctua-nh-d15-g2",
    name: "NH-D15 G2",
    brand: "Noctua",
    category: "refroidissement",
    priceCents: 14900,
    stock: 10,
    keySpec: "Ventirad double tour",
    description: "Aussi efficace qu'un watercooling 280 mm, sans pompe qui peut tomber en panne.",
    specs: [
      ["Type", "Ventirad double tour"],
      ["Hauteur", "168 mm"],
      ["Sockets", "AM5, AM4, LGA1851, LGA1700"],
      ["Ventilateurs", "2 × 140 mm"],
      ["Garantie constructeur", "6 ans"],
    ],
  },
  {
    id: "cool-lf3-360",
    slug: "arctic-liquid-freezer-iii-360",
    name: "Liquid Freezer III 360",
    brand: "Arctic",
    category: "refroidissement",
    priceCents: 9900,
    stock: 15,
    keySpec: "AIO 360 mm",
    description: "Un watercooling tout-en-un performant pour les processeurs qui chauffent le plus.",
    specs: [
      ["Type", "Watercooling AIO"],
      ["Radiateur", "360 mm"],
      ["Sockets", "AM5, AM4, LGA1851, LGA1700"],
      ["Ventilateurs", "3 × 120 mm"],
      ["Garantie constructeur", "6 ans"],
    ],
  },
  {
    id: "per-gprox2",
    slug: "logitech-g-pro-x-superlight-2",
    name: "G Pro X Superlight 2",
    brand: "Logitech",
    category: "peripheriques",
    priceCents: 15900,
    stock: 20,
    keySpec: "Souris sans fil · 60 g",
    description: "60 grammes et un capteur précis : la souris des joueurs compétitifs.",
    specs: [
      ["Type", "Souris sans fil"],
      ["Poids", "60 g"],
      ["Capteur", "HERO 2, 32 000 DPI"],
      ["Autonomie", "95 h"],
    ],
  },
  {
    id: "per-q1max",
    slug: "keychron-q1-max",
    name: "Q1 Max",
    brand: "Keychron",
    category: "peripheriques",
    priceCents: 21900,
    stock: 6,
    keySpec: "Clavier 75 % · aluminium",
    description: "Un clavier mécanique en aluminium, sans fil, aux switches remplaçables sans soudure.",
    specs: [
      ["Type", "Clavier mécanique 75 %"],
      ["Disposition", "AZERTY FR"],
      ["Connexion", "2,4 GHz, Bluetooth, USB-C"],
      ["Boîtier", "Aluminium"],
    ],
  },
];

const bySlug = new Map(products.map((p) => [p.slug, p]));
const byId = new Map(products.map((p) => [p.id, p]));

export function getProductBySlug(slug: string): Product | undefined {
  return bySlug.get(slug);
}

export function getProductById(id: string): Product | undefined {
  return byId.get(id);
}

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}

export function productsIn(category: CategorySlug): Product[] {
  return products.filter((p) => p.category === category);
}

export const brands: string[] = [...new Set(products.map((p) => p.brand))].sort((a, b) =>
  a.localeCompare(b, "fr"),
);
