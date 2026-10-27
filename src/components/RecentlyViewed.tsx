"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { displayName, type Product } from "@/lib/product";
import { formatMoney, isAvailableIn, promoFor, unitPrice } from "@/lib/market";
import { useMarket } from "./MarketProvider";
import { ProductImage } from "./ProductImage";

const KEY = "silicium.vus.v1";
const MAX = 12;

function readIds(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string" && /^\d{1,12}$/.test(x)).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** Enregistre la consultation d'un produit (dans ce navigateur uniquement). */
export function RecordView({ productId }: { productId: string }) {
  useEffect(() => {
    try {
      const ids = [productId, ...readIds().filter((id) => id !== productId)].slice(0, MAX);
      window.localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      // Stockage indisponible : la liste ne sera simplement pas mémorisée.
    }
  }, [productId]);
  return null;
}

/** Les derniers produits vus, relus côté serveur pour afficher les prix du moment. */
export function RecentlyViewed({ excludeId, title = "Vous avez consulté" }: { excludeId?: string; title?: string }) {
  const [items, setItems] = useState<Product[]>([]);
  const market = useMarket();

  useEffect(() => {
    const ids = readIds().filter((id) => id !== excludeId);
    if (!ids.length) return;
    fetch(`/api/produits?ids=${ids.join(",")}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Product[]) => {
        const byId = new Map(list.map((p) => [String(p.id), p]));
        setItems(ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])));
      })
      .catch(() => {});
  }, [excludeId]);

  if (!items.length) return null;
  return (
    <section className="wrap section section-tight" aria-labelledby="vus-title">
      <div className="section-head">
        <h2 id="vus-title">{title}</h2>
      </div>
      <ul className="mini-rail">
        {items.map((p) => {
          const promo = promoFor(p, market);
          return (
            <li key={p.id}>
              <Link href={`/produit/${p.slug}`} className="mini-card">
                <span className="mini-card-img">
                  <ProductImage src={p.image_url} alt="" category={p.category_slug} />
                </span>
                <span className="mini-card-name">
                  {p.brand} {displayName(p)}
                </span>
                <span className="mini-card-price">
                  {isAvailableIn(p, market) ? formatMoney(market, unitPrice(p, market)) : "Non livrable au Cameroun"}
                  {promo && <span className="price-badge">−{promo.pct} %</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
