import { activePromo, type Product } from "@/lib/product";
import { formatPrice } from "@/lib/format";

const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });

// Prix avec promotion : le prix barré est le prix le plus bas des 30 derniers jours (obligation légale),
// et la date de fin affichée est la vraie date de fin de l'offre.
export function PriceTag({ product, size = "sm" }: { product: Product; size?: "sm" | "lg" }) {
  const promo = activePromo(product);
  if (!promo) {
    return <p className={`price price-${size}`}>{formatPrice(product.price_cents)}</p>;
  }
  return (
    <div className={`price-promo price-${size}`}>
      <p className="price-line">
        <span className="price-badge">−{promo.pct} %</span>
        <span className="price price-now">{formatPrice(promo.price)}</span>
      </p>
      <p className="price-ref">
        <span className="visually-hidden">Prix de référence : </span>
        <s>{formatPrice(promo.reference)}</s>
        {size === "lg" && <span> · prix le plus bas des 30 derniers jours</span>}
      </p>
      {size === "lg" && (
        <p className="price-deal">
          {promo.label}, jusqu&apos;au {day.format(new Date(promo.endsAt))}
        </p>
      )}
    </div>
  );
}
