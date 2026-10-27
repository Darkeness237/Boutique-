"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MAX_QTY } from "@/lib/cart";
import { useCart } from "./CartProvider";

// Boutons d'achat de la fiche produit, plus une barre d'achat fixée en bas de l'écran
// qui apparaît quand ces boutons sortent de la vue (utile sur téléphone).
export function BuyBox({
  productId,
  productName,
  priceLabel,
  inStock,
}: {
  productId: string;
  productName: string;
  /** Prix déjà formaté dans la devise du visiteur. */
  priceLabel: string;
  inStock: boolean;
}) {
  const { add } = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShowBar(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!inStock) {
    return (
      <div className="buy-actions" ref={boxRef}>
        <button type="button" className="btn btn-quiet btn-lg" disabled>
          Indisponible pour le moment
        </button>
      </div>
    );
  }

  const addToCart = () => {
    add(productId, qty);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2500);
  };

  return (
    <>
      <div className="buy-actions" ref={boxRef}>
        <label className="qty-select">
          <span>Quantité</span>
          <select value={qty} onChange={(e) => setQty(Number(e.target.value))}>
            {Array.from({ length: MAX_QTY }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={addToCart}>
          {added ? "Ajouté au panier" : "Ajouter au panier"}
        </button>
        <button
          type="button"
          className="btn btn-dark btn-lg btn-block"
          onClick={() => {
            add(productId, qty);
            router.push("/panier");
          }}
        >
          Acheter maintenant
        </button>
        <span className="visually-hidden" role="status">
          {added ? `${qty} × ${productName} ajouté au panier` : ""}
        </span>
      </div>

      <div className={`sticky-buy ${showBar ? "is-visible" : ""}`} aria-hidden={!showBar} inert={!showBar}>
        <div className="wrap sticky-buy-row">
          <p className="sticky-buy-name">{productName}</p>
          <p className="price">{priceLabel}</p>
          <button type="button" className="btn btn-primary" onClick={addToCart}>
            {added ? "Ajouté" : "Ajouter au panier"}
          </button>
        </div>
      </div>
    </>
  );
}
