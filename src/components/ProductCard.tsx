import Link from "next/link";
import { displayName, type Product } from "@/lib/catalog";
import { formatPrice, stockLabel } from "@/lib/format";
import { ProductImage } from "./ProductImage";
import { AddToCartButton } from "./AddToCartButton";

/** Ce qu'on peut dire d'utile en une ligne, avec les seules données disponibles. */
function keySpec(p: Product): string | null {
  if (p.socket && p.memory) return `${p.socket} · ${p.memory}`;
  if (p.socket) return `Socket ${p.socket}`;
  if (p.memory) return p.memory;
  if (p.psu_watts) return `${p.psu_watts} W`;
  return null;
}

export function ProductCard({ product }: { product: Product }) {
  const stock = stockLabel(product.in_stock, product.lead_days);
  const spec = keySpec(product);
  const name = displayName(product);
  return (
    <article className="product-card">
      <Link href={`/produit/${product.slug}`} className="product-card-link">
        <div className="product-card-visual">
          <ProductImage src={product.image_url} alt={`${product.brand} ${name}`} category={product.category_slug} brand={product.brand} />
        </div>
        <p className="product-card-brand">{product.brand}</p>
        <h3 className="product-card-name">{name}</h3>
        {spec && <p className="product-card-spec">{spec}</p>}
      </Link>
      <div className="product-card-foot">
        <div>
          <p className="price">{formatPrice(product.price_cents)}</p>
          <p className={`stock stock-${stock.tone}`}>{stock.short}</p>
        </div>
        <AddToCartButton
          productId={String(product.id)}
          productName={`${product.brand} ${name}`}
          disabled={!product.in_stock}
          compact
        />
      </div>
    </article>
  );
}
