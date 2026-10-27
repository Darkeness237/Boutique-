"use client";

import { useState } from "react";
import { useCart } from "./CartProvider";

export function AddToCartButton({
  productId,
  productName,
  disabled,
  compact,
}: {
  productId: string;
  productName: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { add } = useCart();
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
