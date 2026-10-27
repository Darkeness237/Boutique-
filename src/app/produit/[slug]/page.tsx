import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductCard } from "@/components/ProductCard";
import { ProductVisual } from "@/components/ProductVisual";
import { getCategory, getProductBySlug, products, type Product } from "@/lib/catalog";
import { formatPrice, stockLabel } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = getProductBySlug((await params).slug);
  return product
    ? { title: `${product.brand} ${product.name}`, description: product.description }
    : {};
}

/** Les pièces qui fonctionnent avec celle-ci, pour guider l'achat suivant. */
function compatibleWith(product: Product): { text: string; items: Product[] } | null {
  if (product.category === "processeurs") {
    const items = products.filter((p) => p.category === "cartes-meres" && p.socket === product.socket);
    return { text: `Cartes mères ${product.socket} compatibles`, items };
  }
  if (product.category === "cartes-meres") {
    const items = products.filter((p) => p.category === "processeurs" && p.socket === product.socket);
    return { text: `Processeurs ${product.socket} compatibles`, items };
  }
  if (product.category === "memoire") {
    const items = products.filter((p) => p.category === "cartes-meres" && p.memory === product.memory);
    return { text: `Cartes mères ${product.memory} compatibles`, items };
  }
  if (product.category === "cartes-graphiques" && product.watts) {
    // Carte graphique + processeur haut de gamme + reste de la config, avec 30 % de marge.
    const needed = Math.ceil(((product.watts + 125 + 75) * 1.3) / 50) * 50;
    const items = products.filter((p) => p.category === "alimentations" && (p.psuWatts ?? 0) >= needed);
    return { text: `Alimentations de ${needed} W ou plus conseillées`, items };
  }
  return null;
}

export default async function ProductPage({ params }: Props) {
  const product = getProductBySlug((await params).slug);
  if (!product) notFound();

  const category = getCategory(product.category);
  const stock = stockLabel(product.stock);
  const compat = compatibleWith(product);

  return (
    <>
      <div className="wrap page-head">
        <ol className="breadcrumb" aria-label="Fil d'Ariane">
          <li>
            <Link href="/">Accueil</Link>
          </li>
          {category && (
            <li>
              <Link href={`/catalogue/${category.slug}`}>{category.name}</Link>
            </li>
          )}
          <li aria-current="page">{product.name}</li>
        </ol>
      </div>

      <div className="wrap product-page">
        <div>
          <div className="product-hero-visual">
            <ProductVisual category={product.category} />
          </div>
        </div>

        <div className="product-info">
          <p className="product-brand">{product.brand}</p>
          <h1>{product.name}</h1>
          <p className="product-desc">{product.description}</p>

          <div className="buy-box">
            <p className="price">{formatPrice(product.priceCents)}</p>
            <p className={`stock stock-${stock.tone}`}>{stock.text}</p>
            <div>
              <AddToCartButton productId={product.id} productName={product.name} disabled={product.stock <= 0} />
            </div>
            <p className="buy-note">TVA incluse. Retour gratuit sous 14 jours, garantie légale de 2 ans.</p>
          </div>

          <section className="bench spec-sheet" aria-labelledby="specs-title">
            <h2 id="specs-title">Fiche technique</h2>
            <table className="spec-table">
              <tbody>
                {product.specs.map(([label, value]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {compat && compat.items.length > 0 && (
              <p className="compat-note">
                {compat.text} :{" "}
                {compat.items.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && ", "}
                    <Link href={`/produit/${p.slug}`}>
                      {p.brand} {p.name}
                    </Link>
                  </span>
                ))}
                .
              </p>
            )}
          </section>
        </div>
      </div>

      {compat && compat.items.length > 0 && (
        <section className="wrap section" aria-labelledby="compat-title">
          <div className="section-head">
            <h2 id="compat-title">{compat.text}</h2>
          </div>
          <div className="product-grid">
            {compat.items.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
