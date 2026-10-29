"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getStaff } from "./staff";
import { supabaseForUser } from "./supabase-server";
import { DOC_KINDS, MAX_UPLOAD, MIME_EXT, STATUSES, type DocKind } from "./transit";

export type ActionState = { ok?: boolean; notice?: string };

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).optional().transform((v) => v || null);
const optionalNumber = (min: number, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v.replace(",", ".")) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), "Nombre invalide");

function s(data: FormData, key: string) {
  return String(data.get(key) ?? "");
}

/** Chemin à rafraîchir pour l'espace de l'auteur. */
function pathsFor(id: string) {
  revalidatePath(`/admin/expeditions/${id}`);
  revalidatePath(`/transitaire/${id}`);
  revalidatePath("/admin");
  revalidatePath("/transitaire");
}

function failure(error: { message: string } | null, fallback: string): ActionState {
  if (error) console.error("Transit :", error.message);
  return { notice: fallback };
}

// Expéditions (admin) ---------------------------------------------------------------------------
const shipmentSchema = z.object({
  forwarder_id: uuid,
  order_number: optionalText(20),
  customer_name: optionalText(120),
  customer_city: optionalText(60),
  contents: text(2000).min(1, "Décrivez le contenu de l'expédition."),
  supplier_tracking: optionalText(120),
  expected_parcels: optionalNumber(1, 999),
  expected_weight_kg: optionalNumber(0.01, 99999),
});

export async function createShipment(_prev: ActionState, data: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (staff?.role !== "admin") return { notice: "Action réservée à l'administrateur." };
  const parsed = shipmentSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { notice: parsed.error.issues[0]?.message ?? "Formulaire incomplet." };
  const v = parsed.data;
  const supabase = await supabaseForUser();

  // Rattache la commande si son numéro existe.
  let order_id: string | null = null;
  if (v.order_number) {
    const { data: order } = await supabase.from("orders").select("id").eq("number", v.order_number).maybeSingle<{ id: string }>();
    order_id = order?.id ?? null;
  }
  const { data: created, error } = await supabase
    .from("shipments")
    .insert({ ...v, order_id, expected_parcels: v.expected_parcels ?? null })
    .select("id")
    .single<{ id: string }>();
  if (error || !created) return failure(error, "L'expédition n'a pas pu être créée.");
  revalidatePath("/admin");
  redirect(`/admin/expeditions/${created.id}`);
}

export async function markSeen(id: string) {
  const staff = await getStaff();
  if (staff?.role !== "admin" || !uuid.safeParse(id).success) return;
  const supabase = await supabaseForUser();
  await supabase.from("shipments").update({ admin_seen_at: new Date().toISOString() }).eq("id", id);
}

// Actions communes (transitaire et admin), contrôlées par la base ----------------------------------
const receiveSchema = z.object({
  id: uuid,
  parcels: z.coerce.number().int().min(0).max(999),
  weight: z.coerce.number().min(0).max(99999),
  condition: z.enum(["ok", "abime", "incomplet"]),
  note: text(1500).optional(),
});

export async function receiveShipment(_prev: ActionState, data: FormData): Promise<ActionState> {
  const parsed = receiveSchema.safeParse({
    id: s(data, "id"),
    parcels: s(data, "parcels"),
    weight: s(data, "weight").replace(",", "."),
    condition: s(data, "condition"),
    note: s(data, "note"),
  });
  if (!parsed.success) return { notice: "Indiquez le nombre de colis, le poids et l'état." };
  const v = parsed.data;
  const supabase = await supabaseForUser();
  const { error } = await supabase.rpc("shipment_receive", {
    p_id: v.id,
    p_parcels: v.parcels,
    p_weight: v.weight,
    p_condition: v.condition,
    p_note: v.note ?? "",
  });
  if (error) return failure(error, "La réception n'a pas pu être enregistrée.");
  pathsFor(v.id);
  return { ok: true, notice: "Réception enregistrée." };
}

const stepSchema = z.object({
  id: uuid,
  status: z.enum(Object.keys(STATUSES) as [string, ...string[]]),
  location: text(120).optional(),
  note: text(2000).optional(),
  mode: z.enum(["", "aerien", "maritime"]).optional(),
  awb: text(60).optional(),
  carrier: text(80).optional(),
  eta: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Date invalide"),
});

export async function updateStep(_prev: ActionState, data: FormData): Promise<ActionState> {
  const parsed = stepSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { notice: "Choisissez une étape valide." };
  const v = parsed.data;
  const supabase = await supabaseForUser();
  const { error } = await supabase.rpc("shipment_step", {
    p_id: v.id,
    p_status: v.status,
    p_location: v.location ?? "",
    p_note: v.note ?? "",
    p_mode: v.mode ?? "",
    p_awb: v.awb ?? "",
    p_carrier: v.carrier ?? "",
    p_eta: v.eta || null,
  });
  if (error) return failure(error, "L'étape n'a pas pu être enregistrée.");
  pathsFor(v.id);
  return { ok: true, notice: "Étape enregistrée." };
}

export async function postMessage(_prev: ActionState, data: FormData): Promise<ActionState> {
  const parsed = z.object({ id: uuid, message: text(2000).min(1) }).safeParse(Object.fromEntries(data));
  if (!parsed.success) return { notice: "Écrivez un message." };
  const supabase = await supabaseForUser();
  const { error } = await supabase.rpc("shipment_message", { p_id: parsed.data.id, p_message: parsed.data.message });
  if (error) return failure(error, "Le message n'a pas pu être envoyé.");
  pathsFor(parsed.data.id);
  return { ok: true };
}

// Documents : le navigateur dépose le fichier directement dans le stockage privé, grâce à une
// autorisation d'envoi à usage unique délivrée ici après vérification des droits.
const uploadSchema = z.object({
  id: uuid,
  kind: z.enum(Object.keys(DOC_KINDS) as [DocKind, ...DocKind[]]),
  type: z.enum(Object.keys(MIME_EXT) as [string, ...string[]]),
  size: z.number().int().min(1).max(MAX_UPLOAD),
});

export async function prepareUpload(input: z.input<typeof uploadSchema>) {
  const parsed = uploadSchema.safeParse(input);
  if (!parsed.success) return { error: "Fichier refusé : PDF, JPG, PNG, WEBP ou HEIC de 15 Mo au plus." } as const;
  const v = parsed.data;
  const supabase = await supabaseForUser();
  const { data: allowed } = await supabase.rpc("can_access_shipment", { p_id: v.id });
  if (allowed !== true) return { error: "Accès refusé." } as const;
  const path = `${v.id}/${randomUUID()}.${MIME_EXT[v.type]}`;
  const { data, error } = await supabase.storage.from("transit").createSignedUploadUrl(path);
  if (error || !data) {
    console.error("Transit (envoi) :", error?.message);
    return { error: "L'envoi n'a pas pu démarrer." } as const;
  }
  return { path: data.path, token: data.token } as const;
}

export async function recordDocument(input: { id: string; kind: string; path: string; filename: string }) {
  const parsed = z
    .object({ id: uuid, kind: z.enum(Object.keys(DOC_KINDS) as [DocKind, ...DocKind[]]), path: text(120), filename: text(200).min(1) })
    .safeParse(input);
  if (!parsed.success) return { error: "Document invalide." };
  const supabase = await supabaseForUser();
  const { error } = await supabase.rpc("shipment_add_document", {
    p_id: parsed.data.id,
    p_kind: parsed.data.kind,
    p_path: parsed.data.path,
    p_filename: parsed.data.filename.replace(/[^\p{L}\p{N} ._()-]/gu, "_"),
  });
  if (error) {
    console.error("Transit (document) :", error.message);
    return { error: "Le document n'a pas pu être enregistré." };
  }
  pathsFor(parsed.data.id);
  return { ok: true };
}

// Transitaires (admin) -----------------------------------------------------------------------------
const forwarderSchema = z.object({
  name: text(120).min(2, "Indiquez le nom de la société."),
  contact_email: optionalText(254),
  phone: optionalText(40),
  warehouse_address: optionalText(300),
});

export async function createForwarder(_prev: ActionState, data: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (staff?.role !== "admin") return { notice: "Action réservée à l'administrateur." };
  const parsed = forwarderSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { notice: parsed.error.issues[0]?.message ?? "Formulaire incomplet." };
  const supabase = await supabaseForUser();
  const { error } = await supabase.from("forwarders").insert(parsed.data);
  if (error) return failure(error, "La société n'a pas pu être créée.");
  revalidatePath("/admin/transitaires");
  return { ok: true, notice: "Société créée. Invitez maintenant ses employés." };
}

export async function inviteStaff(_prev: ActionState, data: FormData): Promise<ActionState> {
  const staff = await getStaff();
  if (staff?.role !== "admin") return { notice: "Action réservée à l'administrateur." };
  const parsed = z
    .object({
      email: z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(254),
      role: z.enum(["admin", "forwarder"]),
      forwarder_id: z.string().optional(),
    })
    .safeParse(Object.fromEntries(data));
  if (!parsed.success) return { notice: parsed.error.issues[0]?.message ?? "Formulaire incomplet." };
  const v = parsed.data;
  if (v.role === "forwarder" && !uuid.safeParse(v.forwarder_id).success) return { notice: "Choisissez la société." };
  const supabase = await supabaseForUser();
  const { data: result, error } = await supabase.rpc("admin_invite", {
    p_email: v.email,
    p_role: v.role,
    p_forwarder: v.role === "forwarder" ? v.forwarder_id : null,
  });
  if (error) return failure(error, "L'invitation n'a pas pu être créée.");
  revalidatePath("/admin/transitaires");
  return {
    ok: true,
    notice:
      result === "actif"
        ? `${v.email} avait déjà un compte : l'accès est actif.`
        : `Invitation enregistrée. Demandez à ${v.email} de créer son compte sur /transitaire/inscription (avec cette adresse) : l'accès s'activera tout seul.`,
  };
}

export async function revokeStaff(data: FormData) {
  const staff = await getStaff();
  if (staff?.role !== "admin") return;
  const userId = s(data, "user_id");
  const email = s(data, "email").toLowerCase();
  const supabase = await supabaseForUser();
  if (uuid.safeParse(userId).success) await supabase.from("staff_roles").delete().eq("user_id", userId);
  if (email) await supabase.from("staff_invites").delete().eq("email", email);
  revalidatePath("/admin/transitaires");
}
