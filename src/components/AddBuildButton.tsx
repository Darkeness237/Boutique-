"use client";

import { useState } from "react";
import { useCart } from "./CartProvider";

export function AddBuildButton({ ids, disabled }: { ids: string[]; disabled?: boolean }) {
  const { add } = useCart();
  const [done, setDone] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn btn-signal"
        disabled={disabled}
        onClick={() => {
          ids.forEach((id) => add(id));
          setDone(true);
        }}
      >
        {done ? "Config ajoutée au panier" : `Ajouter les ${ids.length} pièces`}
      </button>
      <span className="visually-hidden" role="status">
        {done ? "Les pièces de la config ont été ajoutées au panier" : ""}
      </span>
    </>
  );
}
