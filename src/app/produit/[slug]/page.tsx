import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddBuildButton } from "@/components/AddBuildButton";
import { BuyBox } from "@/components/BuyBox";
import { Countdown } from "@/components/Countdown";
import { PriceTag } from "@/components/PriceTag";
import { ProductCard } from "@/components/ProductCard";
import { ProductImage } from "@/components/ProductImage";
import { ProductRail } from "@/components/ProductRail";
import { RecentlyViewed, RecordView } from "@/components/RecentlyViewed";
import { bundleFor, similarTo } from "@/lib/bundle";
import { activePromo, displayName, effectivePrice, getCategoryTree, getProductBySlug } from "@/lib/catalog";
import { estimatedPartWatts } from "@/lib/compat";
import { deliveryWindow } from "@/lib/delivery";
import { FREE_SHIPPING_CENTS } from "@/lib/cart";
import { formatPrice, stockLabel } from "@/lib/format";
import { PRICE_NOTE } from "@/lib/legal";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  return product ? { title: `${product.brand} ${displayName(product)}` } : {};
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();

  const [tree, bundle, similar] = await Promise.all([getCategoryTree(), bundleFor(product), similarTo(product)]);
  const category = tree.find((c) => c.slug === product.category_slug);
  const sub = category?.subs.find((s) => s.slug === product.subcategory);
  const stock = stockLabel(product.in_stock, product.lead_days);
  const name = displayName(product);
  const fullName = `${product.brand} ${name}`;
  const promo = activePromo(product);
  const price = effectivePrice(product);
  const delivery = deliveryWindow(product.lead_days);
  const watts = estimatedPartWatts(product);

  const makerSpecs = Array.isArray(product.specs) ? product.specs : [];
  const keyPoints = makerSpecs.filter(([label]) => !/^(marque|couleur|poids|largeur|hauteur|profondeur)/i.test(label)).slice(0, 5);
  const specs: [string, string][] = [
    ["Marque", product.brand],
    ...(makerSpecs.length ? makerSpecs : [["Désignation", product.name] as [string, string]]),
    ...(product.socket ? [["Socket", product.socket] as [string, string]] : []),
    ...(product.memory ? [["Mémoire", product.memory] as [string, string]] : []),
    ...(product.psu_watts ? [["Puissance", `${product.psu_watts} W`] as [string, string]] : []),
    ...(watts ? [["Consommation typique", `${watts} W (estimation)`] as [string, string]] : []),
  ];
  const bundleAll = [product, ...bundle];
  const bundleTotal = bundleAll.reduce((s, p) => s + effectivePrice(p), 0);

  return (
    <>
      <RecordView productId={String(product.id)} />
      <div className="wrap page-head page-head-tight">
        <ol className="breadcrumb" aria-label="Fil d'Ariane">
          <li>
            <Link href="/">Accueil</Link>
          </li>
          {category && (
            <li>
              <Link href={`/catalogue/${category.slug}`}>{category.name}</Link>
            </li>
          )}
          {category && sub && (
            <li>
              <Link href={`/catalogue/${category.slug}?sous=${sub.slug}`}>{sub.name}</Link>
            </li>
          )}
          <li aria-current="page">{name}</li>
        </ol>
      </div>

      <div className="wrap pdp">
        <div className="pdp-gallery">
          <div className="product-hero-visual">
            {promo && <span className="card-flag card-flag-lg">{promo.label}</span>}
            <ProductImage src={product.image_url} alt={fullName} category={product.category_slug} brand={product.brand} priority />
          </div>
        </div>

        <div className="pdp-info">
          <Link href={`/catalogue/${product.category_slug}?marque=${encodeURIComponent(product.brand)}`} className="pdp-brand">
            Voir tous les produits {product.brand}
          </Link>
          <h1>{name}</h1>
          <div className="pdp-price-mobile">
            <PriceTag product={product} size="lg" />
          </div>
          {keyPoints.length > 0 && (
            <section aria-labelledby="points-title" className="pdp-points">
              <h2 id="points-title">Points clés</h2>
              <ul>
                {keyPoints.map(([label, value]) => (
                  <li key={label}>
                    <strong>{label} :</strong> {value}
                  </li>
                ))}
              </ul>
              <a href="#caracteristiques" className="pdp-more">
                Toutes les caractéristiques
              </a>
            </section>
          )}
          {(product.socket || product.memory) && (
            <p className="pdp-compat">
              Compatible {product.socket ? `socket ${product.socket}` : ""}
              {product.socket && product.memory ? " · " : ""}
              {product.memory ?? ""}. Les pièces assorties sont proposées plus bas.
            </p>
          )}
        </div>

        <aside className="pdp-buy" aria-label="Acheter">
          <PriceTag product={product} size="lg" />
          {promo && (
            <p className="pdp-timer">
              <Countdown endsAt={promo.endsAt} />
            </p>
          )}
          <p className="buy-note">{PRICE_NOTE}</p>
          <p className={`stock stock-${stock.tone} pdp-stock`}>{stock.text}</p>
          {product.in_stock && (
            <p className="pdp-delivery">
              Livraison estimée entre le <strong>{delivery.from}</strong> et le <strong>{delivery.to}</strong>
              {price >= FREE_SHIPPING_CENTS ? ", offerte." : `. Offerte dès ${formatPrice(FREE_SHIPPING_CENTS)} d'achat.`}
            </p>
          )}
          <BuyBox productId={String(product.id)} productName={fullName} unitPriceCents={price} inStock={product.in_stock} />
          <ul className="pdp-assurances">
            <li>Paiement sécurisé par Stripe</li>
            <li>Retour gratuit sous 14 jours</li>
            <li>Garantie légale de 2 ans</li>
          </ul>
        </aside>
      </div>

      {bundle.length > 0 && (
        <section className="wrap section section-tight" aria-labelledby="bundle-title">
          <div className="bundle">
            <h2 id="bundle-title">Souvent achetés ensemble</h2>
            <p className="bundle-hint">Des pièces compatibles avec celle-ci, en stock.</p>
            <div className="bundle-row">
              {bundleAll.map((p, i) => (
                <div key={p.id} className="bundle-item">
                  {i > 0 && (
                    <span className="bundle-plus" aria-hidden="true">
                      +
                    </span>
                  )}
                  <Link href={`/produit/${p.slug}`} className="bundle-card">
                    <span className="bundle-img">
                      <ProductImage src={p.image_url} alt="" category={p.category_slug} />
                    </span>
                    <span className="bundle-name">
                      {i === 0 ? "Cet article : " : ""}
                      {p.brand} {displayName(p)}
                    </span>
                    <span className="bundle-price">{formatPrice(effectivePrice(p))}</span>
                  </Link>
                </div>
              ))}
              <div className="bundle-total">
                <p>
                  Total pour les {bundleAll.length} : <strong>{formatPrice(bundleTotal)}</strong>
                </p>
                <AddBuildButton ids={bundleAll.map((p) => String(p.id))} disabled={!product.in_stock} tone="primary" />
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="wrap pdp-details">
        <section className="bench spec-sheet" id="caracteristiques" aria-labelledby="specs-title">
          <h2 id="specs-title">Caractéristiques</h2>
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
              Photo et caractéristiques fournies par le fabricant via Open Icecat, en l&apos;état. Le produit livré fait foi.
            </p>
          )}
        </section>
        <section className="pdp-shipping" aria-labelledby="livraison-title">
          <h2 id="livraison-title">Livraison et retours</h2>
          <dl>
            <dt>Livraison</dt>
            <dd>Colissimo ou point relais. Offerte dès {formatPrice(FREE_SHIPPING_CENTS)} d&apos;achat.</dd>
            <dt>Retours</dt>
            <dd>14 jours pour changer d&apos;avis, retour gratuit d&apos;un produit non utilisé, remboursé sous 14 jours.</dd>
            <dt>Garantie</dt>
            <dd>Garantie légale de conformité de 2 ans : en cas de panne, nous gérons l&apos;échange avec le fabricant.</dd>
          </dl>
        </section>
      </div>

      {similar.length > 0 && (
        <section className="wrap section section-tight" aria-labelledby="similar-title">
          <div className="section-head">
            <h2 id="similar-title">Produits similaires</h2>
            {category && (
              <Link href={`/catalogue/${category.slug}${sub ? `?sous=${sub.slug}` : ""}`}>Tout le rayon</Link>
            )}
          </div>
          <ProductRail label="Produits similaires">
            {similar.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </ProductRail>
        </section>
      )}

      <RecentlyViewed excludeId={String(product.id)} />
    </>
  );
}
