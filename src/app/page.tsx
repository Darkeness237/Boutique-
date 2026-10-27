import Link from "next/link";
import { BuildPanel } from "@/components/BuildPanel";
import { ProductCard } from "@/components/ProductCard";
import { categories, getProductById, productsIn, type Product } from "@/lib/catalog";

const FEATURED_IDS = ["gpu-5070", "cpu-9600x", "mb-b650-tomahawk", "ssd-sn850x-1t", "case-north", "per-gprox2"];

export default function HomePage() {
  const featured = FEATURED_IDS.map(getProductById).filter((p): p is Product => Boolean(p));

  return (
    <>
      <div className="wrap hero">
        <div>
          <h1>Des pièces qui vont ensemble.</h1>
          <p className="hero-lede">
            Composants PC et matériel gaming, avec la compatibilité vérifiée sur chaque fiche : socket,
            mémoire, puissance. Vous montez votre config sans mauvaise surprise.
          </p>
          <div className="hero-actions">
            <Link href="/catalogue/cartes-graphiques" className="btn btn-primary btn-lg">
              Voir les cartes graphiques
            </Link>
            <Link href="/catalogue" className="btn btn-quiet btn-lg">
              Tout le catalogue
            </Link>
          </div>
        </div>
        <BuildPanel />
      </div>

      <section className="wrap section" aria-labelledby="cats-title">
        <div className="section-head">
          <h2 id="cats-title">Par catégorie</h2>
        </div>
        <ul className="cat-index">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={`/catalogue/${c.slug}`}>
                <span className="cat-name">{c.name}</span>
                <span className="cat-count">{productsIn(c.slug).length} produits</span>
                <span className="cat-hint">{c.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="wrap section" aria-labelledby="picks-title">
        <div className="section-head">
          <h2 id="picks-title">Le bon rapport qualité-prix</h2>
          <Link href="/catalogue?tri=prix-croissant">Voir par prix</Link>
        </div>
        <div className="product-grid">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </>
  );
}
