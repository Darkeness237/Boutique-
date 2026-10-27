"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";

export function CartLink() {
  const { count, ready } = useCart();
  const label = ready && count > 0 ? `Panier, ${count} article${count > 1 ? "s" : ""}` : "Panier";
  return (
    <Link href="/panier" className="header-cart" aria-label={label}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          d="M3 4h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="9.5" cy="19.5" r="1.3" fill="currentColor" />
        <circle cx="17" cy="19.5" r="1.3" fill="currentColor" />
      </svg>
      <span className="header-cart-text">Panier</span>
      {ready && count > 0 && <span className="header-cart-count">{count}</span>}
    </Link>
  );
}
