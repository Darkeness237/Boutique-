"use client";

import { useState } from "react";

/** Copie un texte dans le presse-papiers (référence fournisseur, adresse de livraison…). */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-quiet btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? "Copié" : label}
    </button>
  );
}
