// Étapes du configurateur (partagées entre le navigateur et le serveur).

export type StepKey =
  | "cpu" | "board" | "ram" | "gpu" | "storage" | "cooler" | "psu" | "case"
  | "screen" | "keyboard" | "mouse" | "headset" | "chair";

export type Step = {
  key: StepKey;
  label: string;
  category: string;
  subcategories?: string[];
  phase: "pc" | "setup";
  optional?: boolean;
  hint: string;
  /** Sous-catégories écartées d'office (accessoires, formats portables). */
  skipSubs?: string[];
  /** Accessoires reconnus à leur nom, écartés eux aussi. */
  skipName?: RegExp;
};

export const STEPS: Step[] = [
  { key: "cpu", label: "Processeur", category: "processeurs", phase: "pc", hint: "Le socket du processeur décide de la carte mère." },
  { key: "board", label: "Carte mère", category: "cartes-meres", phase: "pc", hint: "Seules les cartes au bon socket sont proposées." },
  { key: "ram", label: "Mémoire", category: "memoire", phase: "pc", skipSubs: ["portable"], skipName: /so-?dimm|portable/i, hint: "Le type de mémoire (DDR4 ou DDR5) suit la carte mère." },
  { key: "gpu", label: "Carte graphique", category: "cartes-graphiques", phase: "pc", optional: true, hint: "Facultative si le processeur a une puce graphique intégrée." },
  { key: "storage", label: "Stockage", category: "stockage", subcategories: ["ssd-nvme", "ssd-sata", "disques-durs"], phase: "pc", hint: "Un SSD NVMe rend le PC réactif." },
  { key: "cooler", label: "Refroidissement", category: "refroidissement", subcategories: ["ventirads", "watercooling"], phase: "pc", hint: "Ventirad ou watercooling pour le processeur." },
  { key: "psu", label: "Alimentation", category: "alimentations", phase: "pc", hint: "Puissance calculée d'après le processeur et la carte graphique." },
  { key: "case", label: "Boîtier", category: "boitiers", subcategories: ["moyen-tour", "mini-tour", "grand-tour"], phase: "pc", hint: "Le boîtier qui accueille tout le reste." },
  { key: "screen", label: "Écran", category: "ecrans", subcategories: ["27-et-plus", "moins-27", "incurves"], phase: "setup", optional: true, hint: "Pour compléter le setup." },
  { key: "keyboard", label: "Clavier", category: "peripheriques", subcategories: ["claviers"], phase: "setup", optional: true, hint: "Mécanique ou membrane." },
  { key: "mouse", label: "Souris", category: "peripheriques", subcategories: ["souris"], phase: "setup", optional: true, hint: "Filaire ou sans fil." },
  { key: "headset", label: "Casque", category: "peripheriques", subcategories: ["casques"], phase: "setup", optional: true, hint: "Pour jouer et discuter." },
  { key: "chair", label: "Fauteuil", category: "fauteuils", phase: "setup", optional: true, skipName: /repose|support|tapis|coussin|accoudoir|roulette|housse/i, hint: "Le confort des longues sessions." },
];

/** Processeurs sans puce graphique intégrée : une carte graphique est alors obligatoire. */
export const NO_IGPU = /sans igpu|\b\d{4,5}F\b|\b\d{3,5}KF\b|\bKF\b/i;
