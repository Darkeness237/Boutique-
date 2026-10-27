"use client";

import { useEffect } from "react";
import { useCart } from "./CartProvider";

/** Vide le panier une fois la commande confirmée. */
export function ClearCart() {
  const { clear, ready } = useCart();
  useEffect(() => {
    if (ready) clear();
  }, [ready, clear]);
  return null;
}
