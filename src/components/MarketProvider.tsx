"use client";

import { createContext, useContext } from "react";
import type { Market } from "@/lib/market";

const MarketContext = createContext<Market>("fr");

export function MarketProvider({ market, children }: { market: Market; children: React.ReactNode }) {
  return <MarketContext.Provider value={market}>{children}</MarketContext.Provider>;
}

export function useMarket(): Market {
  return useContext(MarketContext);
}
