import type { CategorySlug } from "@/lib/catalog";

// Schémas au trait de chaque type de pièce, en attendant les vraies photos produit.
// Ils restent volontairement techniques : on montre une pièce, pas une ambiance.
const drawings: Record<CategorySlug, React.ReactNode> = {
  processeurs: (
    <>
      <rect x="35" y="20" width="50" height="50" rx="3" />
      <rect x="45" y="30" width="30" height="30" rx="2" />
      <path d="M38 23l5 0l-5 5z" className="fill" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <path d={`M${43 + i * 8.5} 20v-5M${43 + i * 8.5} 70v5`} />
          <path d={`M35 ${28 + i * 8.5}h-5M85 ${28 + i * 8.5}h5`} />
        </g>
      ))}
    </>
  ),
  "cartes-meres": (
    <>
      <rect x="22" y="8" width="76" height="74" rx="2" />
      <rect x="34" y="18" width="20" height="20" rx="1.5" />
      <path d="M64 16v28M69 16v28M74 16v28M79 16v28" />
      <rect x="30" y="52" width="58" height="4" rx="1" className="fill" />
      <rect x="30" y="66" width="40" height="3" rx="1" />
      <path d="M22 18h-4v20h4" />
    </>
  ),
  "cartes-graphiques": (
    <>
      <rect x="10" y="24" width="96" height="40" rx="4" />
      <circle cx="38" cy="44" r="14" />
      <circle cx="78" cy="44" r="14" />
      <circle cx="38" cy="44" r="3" className="fill" />
      <circle cx="78" cy="44" r="3" className="fill" />
      <path d="M106 22v46M24 64v6h56v-6" />
    </>
  ),
  memoire: (
    <>
      <rect x="10" y="32" width="100" height="24" rx="2" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={18 + i * 22} y="37" width="14" height="12" rx="1" className="fill" />
      ))}
      <path d="M10 56v4h50v-4M64 56v4h46v-4" />
    </>
  ),
  stockage: (
    <>
      <rect x="14" y="34" width="92" height="22" rx="2" />
      <rect x="22" y="39" width="18" height="12" rx="1" className="fill" />
      <rect x="46" y="39" width="18" height="12" rx="1" />
      <rect x="70" y="39" width="18" height="12" rx="1" />
      <circle cx="100" cy="45" r="3" />
    </>
  ),
  alimentations: (
    <>
      <rect x="22" y="14" width="76" height="62" rx="3" />
      <circle cx="60" cy="45" r="22" />
      <path d="M40 45h40M60 25v40M46 31l28 28M74 31l-28 28" />
    </>
  ),
  boitiers: (
    <>
      <rect x="34" y="6" width="52" height="78" rx="3" />
      <rect x="40" y="12" width="40" height="66" rx="2" />
      <circle cx="60" cy="28" r="7" />
      <circle cx="60" cy="48" r="7" />
      <path d="M38 84v3M82 84v3" />
    </>
  ),
  refroidissement: (
    <>
      <path d="M36 14h48M36 20h48M36 26h48M36 32h48M36 38h48M36 44h48M36 50h48M36 56h48" />
      <rect x="52" y="62" width="16" height="14" rx="1" className="fill" />
      <path d="M56 56v6M64 56v6" />
      <rect x="28" y="10" width="64" height="50" rx="2" />
    </>
  ),
  peripheriques: (
    <>
      <path d="M60 12c-14 0-22 12-22 30v14c0 13 9 22 22 22s22-9 22-22V42c0-18-8-30-22-30z" />
      <path d="M60 12v22M38 38h44" />
      <rect x="57" y="18" width="6" height="10" rx="3" className="fill" />
    </>
  ),
};

export function ProductVisual({ category, className }: { category: CategorySlug; className?: string }) {
  return (
    <svg viewBox="0 0 120 90" className={`product-visual ${className ?? ""}`} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        {drawings[category]}
      </g>
    </svg>
  );
}
