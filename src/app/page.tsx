import Link from "next/link";
import { BuildPanel } from "@/components/BuildPanel";
import { ProductCard } from "@/components/ProductCard";
import { getCategories, inStock, type Product } from "@/lib/catalog";

// Une pièce par catégorie, prise dans le milieu de gamme en stock. Le prix plancher écarte
// les petites pièces (bouchons, adaptateurs) qui n'ont rien à faire en vitrine.
const PICKS: [category: string, minEuros: number][] = [
  ["cartes-graphiques", 250],
  ["processeurs", 150],
  ["cartes-meres", 100],
  ["memoire", 60],
  ["stockage", 50],
  ["boitiers", 60],
  ["refroidissement", 40],
  ["peripheriques", 40],
];

async function featured(): Promise<Product[]> {
  const lists = await Promise.all(
    PICKS.map(([c, min]) => inStock(c, { minPriceCents: min * 100 })),
  );
  return lists.flatMap((list) => (list.length ? [list[Math.floor(list.length * 0.4)]] : []));
}

export default async function HomePage() {
  const [categories, picks] = await Promise.all([getCategories(), featured()]);

  return (
    <>
      <div className="wrap hero">
        <div>
          <h1>Des pièces qui vont ensemble.</h1>
          <p className="hero-lede">
            Composants PC et matériel gaming, avec la compatibilité vérifiée : socket, mémoire, puissance. Vous montez
            votre config sans mauvaise surprise.
          </p>
          <div className="hero-actions">
            <Link href="/catalogue/cartes-graphiques" className="btn btn-primary btn-lg">
              Voir les cartes graphiques
            </Link>
            <Link href="/catalogue?dispo=1" className="btn btn-quiet btn-lg">
              Tout ce qui est en stock
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
                <span className="cat-hint">{c.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {picks.length > 0 && (
        <section className="wrap section" aria-labelledby="picks-title">
          <div className="section-head">
            <h2 id="picks-title">En stock, prêt à partir</h2>
            <Link href="/catalogue?dispo=1&tri=prix-croissant">Tout le stock</Link>
          </div>
          <div className="product-grid">
            {picks.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
