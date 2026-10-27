"use client";

import { useState } from "react";
import { useCart } from "./CartProvider";

// Envoie le panier (identifiants et quantités seulement) au serveur, qui calcule les prix
// et renvoie l'adresse de la page de paiement sécurisée de Stripe.
export function CheckoutButton({ disabled }: { disabled?: boolean }) {
  const { lines } = useCart();
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });

  async function pay() {
    setState({ busy: true, error: null });
    try {
      const res = await fetch("/api/paiement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url || !data.url.startsWith("https://checkout.stripe.com/")) {
        setState({ busy: false, error: data.error ?? "Le paiement n'a pas pu démarrer. Réessayez dans un instant." });
        return;
      }
      window.location.assign(data.url);
    } catch {
      setState({ busy: false, error: "Connexion impossible. Vérifiez votre réseau et réessayez." });
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary btn-lg" onClick={pay} disabled={disabled || state.busy}>
        {state.busy ? "Ouverture du paiement…" : "Passer au paiement"}
      </button>
      {state.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}
    </>
  );
}
