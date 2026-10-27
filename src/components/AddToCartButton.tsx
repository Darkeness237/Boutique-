"use client";

import { useState } from "react";
import { useCart } from "./CartProvider";
import { useMarket } from "./MarketProvider";

export function AddToCartButton({
  productId,
  productName,
  disabled,
  compact,
  cmAvailable = true,
}: {
  productId: string;
  productName: string;
  disabled?: boolean;
  compact?: boolean;
  /** Le produit est-il proposé au Cameroun ? */
  cmAvailable?: boolean;
}) {
  const { add } = useCart();
  const market = useMarket();
  if (market === "cm" && !cmAvailable) disabled = true;
  const [added, setAdded] = useState(false);

  if (disabled) {
    return (
      <button type="button" className={compact ? "btn btn-quiet btn-sm" : "btn btn-quiet"} disabled>
        Indisponible
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className={compact ? "btn btn-primary btn-sm" : "btn btn-primary btn-lg"}
        aria-label={compact ? `Ajouter ${productName} au panier` : undefined}
        onClick={() => {
          add(productId);
          setAdded(true);
          window.setTimeout(() => setAdded(false), 2000);
        }}
      >
        {compact ? (added ? "Ajouté" : "Ajouter") : added ? "Ajouté au panier" : "Ajouter au panier"}
      </button>
      <span className="visually-hidden" role="status">
        {added ? "Article ajouté au panier" : ""}
      </span>
    </>
  );
}
