"use client";

import { formatMoney, promoFor, unitPrice } from "@/lib/market";
import type { Product } from "@/lib/product";
import { useMarket } from "./MarketProvider";

const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });

// Prix dans la devise du visiteur. En promotion (France) : le prix barré est le prix le plus bas
// des 30 derniers jours (obligation légale) et la date de fin est la vraie date de fin de l'offre.
export function PriceTag({ product, size = "sm" }: { product: Product; size?: "sm" | "lg" }) {
  const market = useMarket();
  if (market === "cm" && product.price_xaf === null) {
    return <p className={`price-unavailable price-${size}`}>Non disponible au Cameroun</p>;
  }
  const promo = promoFor(product, market);
  if (!promo) {
    return <p className={`price price-${size}`}>{formatMoney(market, unitPrice(product, market))}</p>;
  }
  return (
    <div className={`price-promo price-${size}`}>
      <p className="price-line">
        <span className="price-badge">−{promo.pct} %</span>
        <span className="price price-now">{formatMoney(market, promo.price)}</span>
      </p>
      <p className="price-ref">
        <span className="visually-hidden">Prix de référence : </span>
        <s>{formatMoney(market, promo.reference)}</s>
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

/** Étiquette d'offre sur la vignette (France uniquement). */
export function PromoFlag({ product, large }: { product: Product; large?: boolean }) {
  const promo = promoFor(product, useMarket());
  return promo ? <span className={`card-flag ${large ? "card-flag-lg" : ""}`}>{promo.label}</span> : null;
}
