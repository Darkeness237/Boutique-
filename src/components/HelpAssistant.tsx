"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { whatsappLink } from "@/lib/contact";
import { useMarket } from "./MarketProvider";

// Assistant d'aide : raccourcis vers les réponses les plus demandées, sans IA ni service externe.
export function HelpAssistant() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const market = useMarket();
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const wa = whatsappLink("Bonjour Vetex PC, j'ai une question : ");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLElement>("input, a, button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <div className="help">
      {open && (
        <div className="help-panel" role="dialog" aria-label="Aide" ref={panel}>
          <div className="help-head">
            <strong>Besoin d&apos;aide ?</strong>
            <button type="button" className="help-close" onClick={() => setOpen(false)} aria-label="Fermer">
              ×
            </button>
          </div>
          <p className="help-msg">
            Bonjour ! {market === "cm" ? "Livraison à Douala et Yaoundé, douane comprise." : "Livraison partout en France."} Que
            cherchez-vous ?
          </p>
          <form
            className="help-search"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) go(`/catalogue?q=${encodeURIComponent(q.trim().slice(0, 80))}`);
            }}
          >
            <label htmlFor="help-q" className="visually-hidden">
              Rechercher un produit
            </label>
            <input id="help-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 RTX 4060, SSD 1 To…" maxLength={80} />
          </form>
          <div className="help-actions">
            <button type="button" onClick={() => go("/suivi")}>📦 Suivre ma commande</button>
            <button type="button" onClick={() => go("/aide#livraison")}>🚚 Livraison et délais</button>
            <button type="button" onClick={() => go("/aide#paiement")}>💳 Moyens de paiement</button>
            <button type="button" onClick={() => go("/aide#garantie")}>🛠️ Panne, garantie, retour</button>
            <button type="button" onClick={() => go("/#config")}>🖥️ Choisir une config compatible</button>
            <button type="button" onClick={() => go("/aide")}>❓ Toutes les questions</button>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="help-wa">
                💬 Parler à un conseiller sur WhatsApp
              </a>
            )}
          </div>
          <p className="help-foot">
            <Link href="/aide" onClick={() => setOpen(false)}>
              Centre d&apos;aide
            </Link>
          </p>
        </div>
      )}
      <button
        type="button"
        className="help-fab"
        aria-expanded={open}
        aria-label={open ? "Fermer l'aide" : "Besoin d'aide ?"}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "×" : "?"}
      </button>
    </div>
  );
}
