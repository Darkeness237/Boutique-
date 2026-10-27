import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductCard } from "@/components/ProductCard";
import { ProductImage } from "@/components/ProductImage";
import { displayName, getCategory, getProductBySlug, inStock, type Product } from "@/lib/catalog";
import { estimatedPartWatts, recommendedPsuWatts } from "@/lib/compat";
import { formatPrice, stockLabel } from "@/lib/format";
import { PRICE_NOTE } from "@/lib/legal";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  return product ? { title: `${product.brand} ${displayName(product)}` } : {};
}

/** Les pièces en stock qui fonctionnent avec celle-ci, pour guider l'achat suivant. */
async function compatibleWith(p: Product): Promise<{ text: string; items: Product[] } | null> {
  if (p.category_slug === "processeurs" && p.socket) {
    return { text: `Cartes mères ${p.socket} en stock`, items: await inStock("cartes-meres", { socket: p.socket }, 4) };
  }
  if (p.category_slug === "cartes-meres" && p.socket) {
    const items = await inStock("processeurs", { socket: p.socket }, 4);
    return { text: `Processeurs ${p.socket} en stock`, items };
  }
  if (p.category_slug === "memoire" && p.memory) {
    return { text: `Cartes mères ${p.memory} en stock`, items: await inStock("cartes-meres", { memory: p.memory }, 4) };
  }
  if (p.category_slug === "cartes-graphiques") {
    // Avec un processeur haut de gamme, pour ne pas sous-dimensionner.
    const needed = recommendedPsuWatts([p, { category_slug: "processeurs", name: "Ryzen 9" }]);
    const items = (await inStock("alimentations")).filter((a) => (a.psu_watts ?? 0) >= needed).slice(0, 4);
    return { text: `Alimentations de ${needed} W ou plus en stock`, items };
  }
  return null;
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();

  const [category, compat] = await Promise.all([getCategory(product.category_slug), compatibleWith(product)]);
  const stock = stockLabel(product.in_stock, product.lead_days);
  const name = displayName(product);
  const watts = estimatedPartWatts(product);

  const makerSpecs = Array.isArray(product.specs) ? product.specs : [];
  const specs: [string, string][] = [
    ["Marque", product.brand],
    ...(makerSpecs.length ? makerSpecs : [["Désignation", product.name] as [string, string]]),
    ...(product.socket ? [["Socket", product.socket] as [string, string]] : []),
    ...(product.memory ? [["Mémoire", product.memory] as [string, string]] : []),
    ...(product.psu_watts ? [["Puissance", `${product.psu_watts} W`] as [string, string]] : []),
    ...(watts ? [["Consommation typique", `${watts} W (estimation)`] as [string, string]] : []),
    ["Disponibilité", stock.text],
  ];

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
          <li aria-current="page">{name}</li>
        </ol>
      </div>

      <div className="wrap product-page">
        <div>
          <div className="product-hero-visual">
            <ProductImage
              src={product.image_url}
              alt={`${product.brand} ${name}`}
              category={product.category_slug}
              brand={product.brand}
              priority
            />
          </div>
        </div>

        <div className="product-info">
          <p className="product-brand">{product.brand}</p>
          <h1>{name}</h1>

          <div className="buy-box">
            <p className="price">{formatPrice(product.price_cents)}</p>
            <p className={`stock stock-${stock.tone}`}>{stock.text}</p>
            <div>
              <AddToCartButton
                productId={String(product.id)}
                productName={`${product.brand} ${name}`}
                disabled={!product.in_stock}
              />
            </div>
            <p className="buy-note">{PRICE_NOTE}. Retour gratuit sous 14 jours, garantie légale de 2 ans.</p>
          </div>

          <section className="bench spec-sheet" aria-labelledby="specs-title">
            <h2 id="specs-title">Fiche technique</h2>
            <table className="spec-table">
              <tbody>
                {specs.map(([label, value]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {product.media_source === "icecat" && (
              <p className="compat-note">
                Photo et caractéristiques fournies par le fabricant via Open Icecat, en l&apos;état. Le produit livré
                fait foi.
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
            {compat.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
