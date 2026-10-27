"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { displayName, type Product } from "@/lib/product";
import type { DeliveryZone } from "@/lib/catalog";
import { formatMoney, isAvailableIn, priceNote, promoFor, unitPrice } from "@/lib/market";
import { FREE_SHIPPING_CENTS, MAX_QTY, SHIPPING_CENTS, priceCart } from "@/lib/cart";
import { PRICE_NOTE, TOTAL_LABEL } from "@/lib/legal";
import { useCart } from "./CartProvider";
import { CheckoutButton } from "./CheckoutButton";
import { useMarket } from "./MarketProvider";
import { ProductVisual } from "./ProductVisual";

type Load = { status: "loading" } | { status: "ready"; products: Product[] } | { status: "error" };

export function CartView({ zones }: { zones: DeliveryZone[] }) {
  const { lines: raw, ready, setQty, remove } = useCart();
  const market = useMarket();
  const [zone, setZone] = useState(zones[0]?.slug ?? "");
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const idsKey = raw.map((l) => l.id).sort().join(",");

  useEffect(() => {
    if (!ready) return;
    if (!idsKey) {
      setLoad({ status: "ready", products: [] });
      return;
    }
    const controller = new AbortController();
    // Les prix sont relus côté serveur à chaque affichage du panier.
    fetch(`/api/produits?ids=${encodeURIComponent(idsKey)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((products: Product[]) => setLoad({ status: "ready", products }))
      .catch((e) => {
        if (e.name !== "AbortError") setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, [ready, idsKey]);

  if (!ready || load.status === "loading") {
    return <p className="result-count">Chargement du panier…</p>;
  }
  if (load.status === "error") {
    return (
      <div className="empty">
        <h2>Le panier n&apos;a pas pu être chargé</h2>
        <p>Vos articles sont conservés. Rechargez la page dans un instant.</p>
      </div>
    );
  }

  const { lines, subtotalCents } = priceCart(raw, load.products, market);
  const money = (n: number) => formatMoney(market, n);

  if (lines.length === 0) {
    return (
      <div className="empty">
        <h2>Votre panier est vide</h2>
        <p>Ajoutez des pièces depuis le catalogue, ou partez de la config du moment sur l&apos;accueil.</p>
        <Link href="/catalogue" className="btn btn-primary">
          Parcourir le catalogue
        </Link>
      </div>
    );
  }

  // France : livraison offerte au-delà du seuil. Cameroun : tarif de livraison à domicile de la ville.
  const cmZone = zones.find((z) => z.slug === zone);
  const shipping =
    market === "cm" ? (cmZone?.fee_xaf ?? 0) : subtotalCents >= FREE_SHIPPING_CENTS ? 0 : SHIPPING_CENTS;
  const missing = market === "fr" ? FREE_SHIPPING_CENTS - subtotalCents : 0;
  const unavailable = lines.some((l) => !l.product.in_stock || !isAvailableIn(l.product, market));

  return (
    <div className="cart-layout">
      <ul className="cart-lines">
        {lines.map(({ product, qty, totalCents }) => {
          const id = String(product.id);
          const name = `${product.brand} ${displayName(product)}`;
          return (
            <li key={id} className="cart-line">
              <div className="cart-line-visual">
                <ProductVisual category={product.category_slug} />
              </div>
              <div>
                <Link href={`/produit/${product.slug}`} className="cart-line-name">
                  {name}
                </Link>
                <p className="cart-line-meta">
                  {money(unitPrice(product, market))} l&apos;unité
                  {promoFor(product, market) && <span className="price-badge">−{promoFor(product, market)!.pct} %</span>}
                </p>
                <div className="cart-line-controls">
                  <div className="qty" role="group" aria-label={`Quantité de ${name}`}>
                    <button type="button" onClick={() => setQty(id, qty - 1)} disabled={qty <= 1} aria-label="Retirer un">
                      −
                    </button>
                    <output aria-live="polite">{qty}</output>
                    <button type="button" onClick={() => setQty(id, qty + 1)} disabled={qty >= MAX_QTY} aria-label="Ajouter un">
                      +
                    </button>
                  </div>
                  <button type="button" className="link-btn" onClick={() => remove(id)}>
                    Retirer
                  </button>
                </div>
                {!product.in_stock && <p className="field-error">Plus en stock : retirez-le pour passer commande.</p>}
                {product.in_stock && !isAvailableIn(product, market) && (
                  <p className="field-error">Non disponible au Cameroun pour le moment : retirez-le pour passer commande.</p>
                )}
              </div>
              <p className="cart-line-total">{money(totalCents)}</p>
            </li>
          );
        })}
      </ul>

      <aside className="summary" aria-labelledby="summary-title">
        <h2 id="summary-title">Récapitulatif</h2>
        <p className="summary-row">
          <span>Sous-total</span>
          <span>{money(subtotalCents)}</span>
        </p>
        {market === "cm" && zones.length > 0 && (
          <label className="zone-select">
            <span>Ville de livraison</span>
            <select value={zone} onChange={(e) => setZone(e.target.value)}>
              {zones.map((z) => (
                <option key={z.slug} value={z.slug}>
                  {z.city} : {money(z.fee_xaf)}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="summary-row">
          <span>{market === "cm" ? "Livraison à domicile" : "Livraison"}</span>
          <span>{shipping === 0 ? "Offerte" : money(shipping)}</span>
        </p>
        {missing > 0 && <p className="summary-note">Plus que {money(missing)} pour la livraison offerte.</p>}
        <p className="summary-row summary-total">
          <span>{market === "cm" ? "Total à payer" : TOTAL_LABEL}</span>
          <span>{money(subtotalCents + shipping)}</span>
        </p>
        <p className="summary-note">{priceNote(market, PRICE_NOTE)}</p>
        {market === "fr" ? (
          <CheckoutButton disabled={unavailable} />
        ) : (
          <button type="button" className="btn btn-primary btn-lg" disabled>
            Passer au paiement
          </button>
        )}
        <p className="summary-note">
          {unavailable
            ? "Retirez les articles indisponibles pour continuer."
            : market === "cm"
              ? "Le paiement par Orange Money et MTN MoMo arrive bientôt."
              : "Carte bancaire, Apple Pay ou Google Pay, sur la page sécurisée de Stripe."}
        </p>
      </aside>
    </div>
  );
}
