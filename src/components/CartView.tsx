"use client";

import Link from "next/link";
import { FREE_SHIPPING_CENTS, MAX_QTY, SHIPPING_CENTS, priceCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { useCart } from "./CartProvider";
import { ProductVisual } from "./ProductVisual";

export function CartView() {
  const { lines: raw, ready, setQty, remove } = useCart();

  if (!ready) {
    return <p className="result-count">Chargement du panier…</p>;
  }

  const { lines, subtotalCents } = priceCart(raw);

  if (lines.length === 0) {
    return (
      <div className="empty">
        <h2>Votre panier est vide</h2>
        <p>Ajoutez des pièces depuis le catalogue, ou partez de la config 1440p de l&apos;accueil.</p>
        <Link href="/catalogue" className="btn btn-primary">
          Parcourir le catalogue
        </Link>
      </div>
    );
  }

  const shipping = subtotalCents >= FREE_SHIPPING_CENTS ? 0 : SHIPPING_CENTS;
  const missing = FREE_SHIPPING_CENTS - subtotalCents;

  return (
    <div className="cart-layout">
      <ul className="cart-lines">
        {lines.map(({ product, qty, totalCents }) => {
          const max = Math.min(MAX_QTY, product.stock);
          return (
            <li key={product.id} className="cart-line">
              <div className="cart-line-visual">
                <ProductVisual category={product.category} />
              </div>
              <div>
                <Link href={`/produit/${product.slug}`} className="cart-line-name">
                  {product.brand} {product.name}
                </Link>
                <p className="cart-line-meta">{formatPrice(product.priceCents)} l&apos;unité</p>
                <div className="cart-line-controls">
                  <div className="qty" role="group" aria-label={`Quantité de ${product.name}`}>
                    <button
                      type="button"
                      onClick={() => setQty(product.id, qty - 1)}
                      disabled={qty <= 1}
                      aria-label="Retirer un"
                    >
                      −
                    </button>
                    <output aria-live="polite">{qty}</output>
                    <button
                      type="button"
                      onClick={() => setQty(product.id, qty + 1)}
                      disabled={qty >= max}
                      aria-label="Ajouter un"
                    >
                      +
                    </button>
                  </div>
                  <button type="button" className="link-btn" onClick={() => remove(product.id)}>
                    Retirer
                  </button>
                </div>
                {product.stock <= 0 && (
                  <p className="field-error">Plus en stock : retirez-le pour passer commande.</p>
                )}
              </div>
              <p className="cart-line-total">{formatPrice(totalCents)}</p>
            </li>
          );
        })}
      </ul>

      <aside className="summary" aria-labelledby="summary-title">
        <h2 id="summary-title">Récapitulatif</h2>
        <p className="summary-row">
          <span>Sous-total</span>
          <span>{formatPrice(subtotalCents)}</span>
        </p>
        <p className="summary-row">
          <span>Livraison</span>
          <span>{shipping === 0 ? "Offerte" : formatPrice(shipping)}</span>
        </p>
        {missing > 0 && (
          <p className="summary-note">
            Plus que {formatPrice(missing)} pour la livraison offerte.
          </p>
        )}
        <p className="summary-row summary-total">
          <span>Total TTC</span>
          <span>{formatPrice(subtotalCents + shipping)}</span>
        </p>
        {/* Le paiement passera par Stripe Checkout : le serveur recalculera les prix
            à partir des identifiants, sans jamais faire confiance au navigateur. */}
        <button type="button" className="btn btn-primary btn-lg" disabled>
          Passer au paiement
        </button>
        <p className="summary-note">
          Le paiement en ligne arrive bientôt. Votre carte sera saisie sur la page sécurisée de Stripe.
        </p>
      </aside>
    </div>
  );
}
