import Link from "next/link";
import { BuildPanel } from "@/components/BuildPanel";
import { ProductCard } from "@/components/ProductCard";
import { ProductRail } from "@/components/ProductRail";
import { Ticker } from "@/components/Ticker";
import { getCategories, getTopBrands, inStock, type Product } from "@/lib/catalog";

// Rayons mis en avant : produits en stock, avec photo, au-dessus d'un prix plancher
// (pour ne pas exposer en vitrine des bouchons ou des adaptateurs).
const RAILS: { category: string; title: string; minEuros: number }[] = [
  { category: "cartes-graphiques", title: "Cartes graphiques en stock", minEuros: 250 },
  { category: "boitiers", title: "Boîtiers", minEuros: 60 },
  { category: "refroidissement", title: "Refroidissement", minEuros: 40 },
  { category: "peripheriques", title: "Souris, claviers, casques", minEuros: 30 },
];

const COVER_MIN_EUROS: Record<string, number> = {
  "cartes-graphiques": 250, processeurs: 150, "cartes-meres": 100, memoire: 60, stockage: 50,
  alimentations: 60, boitiers: 60, refroidissement: 40, ecrans: 120, peripheriques: 30, fauteuils: 100,
};

export default async function HomePage() {
  const categories = await getCategories();
  const [rails, covers, brands] = await Promise.all([
    Promise.all(RAILS.map((r) => inStock(r.category, { minPriceCents: r.minEuros * 100, withImage: true }, 14))),
    Promise.all(
      categories.map(async (c) => {
        const list = await inStock(c.slug, { minPriceCents: (COVER_MIN_EUROS[c.slug] ?? 10) * 100, withImage: true }, 5);
        return [c.slug, list[Math.min(2, list.length - 1)] ?? null] as [string, Product | null];
      }),
    ),
    getTopBrands(28),
  ]);
  const coverBySlug = new Map(covers);

  return (
    <>
      <div className="wrap hero">
        <div className="hero-copy">
          <h1>Des pièces qui vont ensemble.</h1>
          <p className="hero-lede">
            Composants PC et matériel gaming, avec la compatibilité vérifiée : socket, mémoire, puissance. Vous montez
            votre config sans mauvaise surprise.
          </p>
          <div className="hero-actions">
            <Link href="/catalogue/cartes-graphiques?dispo=1" className="btn btn-primary btn-lg">
              Voir les cartes graphiques
            </Link>
            <Link href="/catalogue?dispo=1" className="btn btn-quiet btn-lg">
              Tout ce qui est en stock
            </Link>
          </div>
        </div>
        <BuildPanel />
      </div>

      {brands.length > 0 && <Ticker label="Marques disponibles" items={brands} tone="dark" />}

      <section className="wrap section" aria-labelledby="cats-title">
        <div className="section-head">
          <h2 id="cats-title">Par catégorie</h2>
        </div>
        <ul className="cat-grid">
          {categories.map((c) => {
            const cover = coverBySlug.get(c.slug);
            return (
              <li key={c.slug}>
                <Link href={`/catalogue/${c.slug}`} className="cat-tile">
                  <span className="cat-tile-img" aria-hidden="true">
                    {cover?.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover.image_url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                    )}
                  </span>
                  <span className="cat-name">{c.name}</span>
                  <span className="cat-hint">{c.hint}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {RAILS.map((r, i) =>
        rails[i].length > 0 ? (
          <section key={r.category} className="wrap section section-tight" aria-labelledby={`rail-${r.category}`}>
            <div className="section-head">
              <h2 id={`rail-${r.category}`}>{r.title}</h2>
              <Link href={`/catalogue/${r.category}?dispo=1`}>Tout voir</Link>
            </div>
            <ProductRail label={r.title}>
              {rails[i].map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </ProductRail>
          </section>
        ) : null,
      )}
    </>
  );
}
