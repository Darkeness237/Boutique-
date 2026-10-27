import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { formatPrice, stockLabel } from "@/lib/format";
import { ProductVisual } from "./ProductVisual";
import { AddToCartButton } from "./AddToCartButton";

export function ProductCard({ product }: { product: Product }) {
  const stock = stockLabel(product.stock);
  return (
    <article className="product-card">
      <Link href={`/produit/${product.slug}`} className="product-card-link">
        <div className="product-card-visual">
          <ProductVisual category={product.category} />
        </div>
        <p className="product-card-brand">{product.brand}</p>
        <h3 className="product-card-name">{product.name}</h3>
        <p className="product-card-spec">{product.keySpec}</p>
      </Link>
      <div className="product-card-foot">
        <div>
          <p className="price">{formatPrice(product.priceCents)}</p>
          <p className={`stock stock-${stock.tone}`}>{stock.tone === "ok" ? "En stock" : stock.text}</p>
        </div>
        <AddToCartButton productId={product.id} productName={product.name} disabled={product.stock <= 0} compact />
      </div>
    </article>
  );
}
