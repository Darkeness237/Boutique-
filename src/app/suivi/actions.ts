"use server";

import { z } from "zod";
import { supabase } from "@/lib/supabase";

export type TrackState = {
  error?: string;
  result?: { number: string; status: string; market: string; created_at: string; tracking: string | null; shipment_status: string | null; shipment_eta: string | null };
};

export async function trackOrder(_prev: TrackState, data: FormData): Promise<TrackState> {
  const parsed = z
    .object({ number: z.string().trim().toUpperCase().regex(/^SIL-\d{1,9}$/), email: z.string().trim().email().max(254) })
    .safeParse({ number: data.get("number"), email: data.get("email") });
  if (!parsed.success) return { error: "Indiquez le numéro de commande (SIL-…) et l'adresse e-mail utilisée." };
  const { data: rows, error } = await supabase.rpc("order_track", { p_number: parsed.data.number, p_email: parsed.data.email });
  if (error) return { error: "Le suivi est momentanément indisponible. Réessayez dans un instant." };
  const row = (rows as TrackState["result"][] | null)?.[0];
  // Même message si la commande n'existe pas ou si l'e-mail ne correspond pas.
  if (!row) return { error: "Aucune commande ne correspond à ce numéro et à cette adresse e-mail." };
  return { result: row };
}
