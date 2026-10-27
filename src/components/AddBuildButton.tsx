"use client";

import { useState } from "react";
import { useCart } from "./CartProvider";

export function AddBuildButton({ ids, disabled, tone = "signal" }: { ids: string[]; disabled?: boolean; tone?: "signal" | "primary" }) {
  const { add } = useCart();
  const [done, setDone] = useState(false);
  return (
    <>
      <button
        type="button"
        className={tone === "primary" ? "btn btn-primary" : "btn btn-signal"}
        disabled={disabled}
        onClick={() => {
          ids.forEach((id) => add(id));
          setDone(true);
        }}
      >
        {done ? "Ajoutées au panier" : `Ajouter les ${ids.length} au panier`}
      </button>
      <span className="visually-hidden" role="status">
        {done ? "Les pièces de la config ont été ajoutées au panier" : ""}
      </span>
    </>
  );
}
