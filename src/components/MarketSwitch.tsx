"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { MARKET_COOKIE, MARKETS, type Market } from "@/lib/market";
import { useMarket } from "./MarketProvider";

// Choix du pays de livraison : change la devise, les prix et les conditions de livraison.
export function MarketSwitch() {
  const market = useMarket();
  const router = useRouter();
  const [pending, start] = useTransition();

  const choose = (m: Market) => {
    if (m === market) return;
    document.cookie = `${MARKET_COOKIE}=${m}; path=/; max-age=31536000; samesite=lax; secure`;
    // Choix explicite : il prime désormais sur la détection automatique du pays.
    document.cookie = `marche_choix=1; path=/; max-age=31536000; samesite=lax; secure`;
    start(() => router.refresh());
  };

  return (
    <div className="market-switch" role="group" aria-label="Pays de livraison" aria-busy={pending}>
      {(Object.keys(MARKETS) as Market[]).map((m) => (
        <button key={m} type="button" aria-pressed={m === market} onClick={() => choose(m)} disabled={pending}>
          {MARKETS[m].label}
          <span>{MARKETS[m].currency === "EUR" ? "€" : "FCFA"}</span>
        </button>
      ))}
    </div>
  );
}
