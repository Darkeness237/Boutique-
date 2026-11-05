"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isOrderStatus } from "./admin-orders";
import type { ActionState } from "./pricing-actions";
import { getStaff } from "./staff";
import { supabaseForUser } from "./supabase-server";

const schema = z.object({
  id: z.string().uuid(),
  status: z.string().refine(isOrderStatus, "Statut inconnu."),
  supplier_ref: z.string().trim().max(120),
  carrier: z.string().trim().max(60),
  tracking: z.string().trim().max(80),
  note: z.string().trim().max(2000),
});

/** Met à jour le suivi d'une commande (statut, référence fournisseur, transporteur, numéro de suivi, note). */
export async function updateOrder(_prev: ActionState, data: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (staff?.role !== "admin") return { notice: "Réservé à l'administrateur." };
  const parsed = schema.safeParse({
    id: data.get("id"),
    status: data.get("status"),
    supplier_ref: data.get("supplier_ref") ?? "",
    carrier: data.get("carrier") ?? "",
    tracking: data.get("tracking") ?? "",
    note: data.get("note") ?? "",
  });
  if (!parsed.success) return { notice: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const p = parsed.data;
  if (p.status === "expediee" && !p.tracking) return { notice: "Indiquez le numéro de suivi pour passer la commande en « Expédiée »." };

  const supabase = await supabaseForUser();
  const { error } = await supabase.rpc("admin_order_update", {
    p_id: p.id,
    p_status: p.status,
    p_supplier_ref: p.supplier_ref,
    p_carrier: p.carrier,
    p_tracking: p.tracking,
    p_note: p.note,
  });
  if (error) {
    console.error("Commande (mise à jour) :", error.message);
    return { notice: "L'enregistrement n'a pas abouti." };
  }
  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${p.id}`);
  return { ok: true, notice: "Commande mise à jour." };
}
