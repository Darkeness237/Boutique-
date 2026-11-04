"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFavorites } from "@/components/FavoritesProvider";
import { ProductCard } from "@/components/ProductCard";
import type { Product } from "@/lib/product";

export function FavoritesView() {
  const { ids, ready } = useFavorites();
  const [products, setProducts] = useState<Product[] | null>(null);
  const key = ids.slice(0, 50).join(",");

  useEffect(() => {
    if (!ready) return;
    if (!key) return setProducts([]);
    const c = new AbortController();
    fetch(`/api/produits?ids=${encodeURIComponent(key)}`, { signal: c.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Product[]) => setProducts(list))
      .catch(() => {});
    return () => c.abort();
  }, [ready, key]);

  if (!ready || products === null) return <p className="result-count">Chargement…</p>;
  if (products.length === 0) {
    return (
      <div className="empty">
        <h2>Aucun favori pour l&apos;instant</h2>
        <p>Touchez le cœur sur un produit pour le retrouver ici.</p>
        <Link href="/catalogue" className="btn btn-primary">
          Parcourir le catalogue
        </Link>
      </div>
    );
  }
  const order = new Map(ids.map((id, i) => [id, i]));
  return (
    <div className="product-grid">
      {[...products]
        .sort((a, b) => (order.get(String(a.id)) ?? 0) - (order.get(String(b.id)) ?? 0))
        .map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
    </div>
  );
}
