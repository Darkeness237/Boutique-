import { createClient } from "@supabase/supabase-js";

// Client sans cache, réservé aux commandes : chaque appel doit atteindre la base.
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
});

export type PaidOrder = {
  market: "fr" | "cm";
  currency: "eur" | "xaf";
  subtotal: number;
  shipping: number;
  total: number;
  email: string;
  customer_name: string | null;
  phone: string | null;
  shipping_address: Record<string, string | null>;
  stripe_session_id: string;
  stripe_payment_intent: string | null;
  items: { product_id: number | null; name: string; qty: number; unit_price: number }[];
};

/** Enregistre une commande payée (idempotent) et renvoie son numéro. */
export async function recordPaidOrder(order: PaidOrder): Promise<string> {
  const token = process.env.ORDERS_TOKEN;
  if (!token) throw new Error("ORDERS_TOKEN manquant");
  const { data, error } = await db.rpc("record_paid_order", { p_token: token, p_order: order });
  if (error) throw new Error(`Enregistrement de la commande : ${error.message}`);
  return data as string;
}

export type OrderSummary = {
  number: string;
  status: string;
  currency: string;
  total: number;
  items: { name: string; qty: number }[] | null;
};

export async function orderSummary(sessionId: string): Promise<OrderSummary | null> {
  const { data, error } = await db.rpc("order_summary", { p_session_id: sessionId });
  if (error) throw new Error(`Résumé de commande : ${error.message}`);
  return ((data as OrderSummary[]) ?? [])[0] ?? null;
}
