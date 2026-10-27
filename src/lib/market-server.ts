import { cookies } from "next/headers";
import { MARKET_COOKIE, parseMarket, type Market } from "./market";

/** Marché du visiteur, lu côté serveur (cookie posé par le sélecteur ou le middleware). */
export async function getMarket(): Promise<Market> {
  return parseMarket((await cookies()).get(MARKET_COOKIE)?.value);
}
