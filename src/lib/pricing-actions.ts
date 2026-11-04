"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseEuros } from "./pricing";
import { getStaff } from "./staff";
import { supabaseForUser } from "./supabase-server";

export type ActionState = { ok?: boolean; notice?: string };

async function admin() {
  const staff = await getStaff();
  if (staff?.role !== "admin") throw new Error("Réservé à l'administrateur.");
  return supabaseForUser();
}

function refresh(productId?: number) {
  revalidatePath("/admin/pricing");
  revalidatePath("/admin/alertes");
  if (productId) revalidatePath(`/admin/pricing/${productId}`);
}

/** Valide ou refuse une sélection de prix conseillés. */
export async function decidePrices(data: FormData) {
  const supabase = await admin();
  const ids = data.getAll("id").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 500);
  if (ids.length === 0) return;
  const { error } = await supabase.rpc("admin_pricing_decide", { p_ids: ids, p_accept: data.get("decision") === "accept" });
  if (error) console.error("Pricing (décision) :", error.message);
  refresh();
}

export async function saveOverride(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin();
  const id = Number(data.get("product_id"));
  if (!Number.isInteger(id) || id <= 0) return { notice: "Produit invalide." };
  const marginPct = String(data.get("min_margin_pct") ?? "").trim().replace(",", ".");
  const payload = {
    fixed_price_cents: parseEuros(data.get("fixed_price")),
    min_margin_pct: marginPct ? Math.min(80, Math.max(0, Number(marginPct))) : null,
    min_margin_cents: parseEuros(data.get("min_margin")),
    exclude: data.get("exclude") === "on",
    featured: data.get("featured") === "on",
    note: String(data.get("note") ?? "").slice(0, 500),
  };
  if (payload.min_margin_pct !== null && !Number.isFinite(payload.min_margin_pct)) return { notice: "Marge invalide." };
  const { error } = await supabase.rpc("admin_set_override", { p_product: id, p: payload });
  if (error) {
    console.error("Pricing (réglage produit) :", error.message);
    return { notice: "L'enregistrement n'a pas abouti." };
  }
  refresh(id);
  return { ok: true, notice: "Réglages du produit enregistrés." };
}

export async function saveCompetitorUrl(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin();
  const parsed = z
    .object({
      product_id: z.coerce.number().int().positive(),
      competitor_id: z.coerce.number().int().positive(),
      url: z.string().trim().url().startsWith("https://").max(500).optional().or(z.literal("")),
      price: z.string().optional(),
    })
    .safeParse(Object.fromEntries(data));
  if (!parsed.success) return { notice: "Adresse invalide (elle doit commencer par https://)." };
  const v = parsed.data;
  const { data: comp } = await supabase.from("competitors").select("domain").eq("id", v.competitor_id).maybeSingle<{ domain: string }>();
  if (!comp) return { notice: "Concurrent inconnu." };
  if (v.url) {
    if (new URL(v.url).hostname !== comp.domain) return { notice: `L'adresse doit être sur ${comp.domain}.` };
    const { error } = await supabase
      .from("competitor_urls")
      .upsert({ product_id: v.product_id, competitor_id: v.competitor_id, url: v.url }, { onConflict: "product_id,competitor_id" });
    if (error) return { notice: "L'adresse n'a pas pu être enregistrée." };
  }
  const price = parseEuros(v.price ?? null);
  if (price) {
    const { error } = await supabase
      .from("competitor_prices")
      .insert({ product_id: v.product_id, competitor_id: v.competitor_id, price_cents: price, in_stock: true, source: "manuel" });
    if (error) return { notice: "Le prix n'a pas pu être enregistré." };
    await supabase.rpc("admin_run_pricing");
  }
  refresh(v.product_id);
  return { ok: true, notice: price ? "Prix enregistré, suggestion recalculée." : "Adresse enregistrée : le prix sera relevé cette nuit." };
}

/** Import CSV : ean;concurrent;prix[;url] (séparateur « ; » ou « , », en-tête facultatif). */
export async function importCompetitorCsv(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin();
  const file = data.get("file");
  if (!(file instanceof File) || file.size === 0) return { notice: "Choisissez un fichier CSV." };
  if (file.size > 800_000) return { notice: "Fichier trop volumineux (800 Ko au plus, découpez-le)." };
  const text = (await file.text()).replace(/^﻿/, "");
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.split(l.includes(";") ? ";" : ",").map((c) => c.trim().replace(/^"|"$/g, "")))
    .filter((c) => c.length >= 3 && /^\d{8,14}$/.test(c[0]))
    .map(([ean, concurrent, prix, url]) => ({ ean, concurrent, prix, url: url ?? "" }));
  if (rows.length === 0) return { notice: "Aucune ligne valide. Format attendu : ean;concurrent;prix;url" };
  if (rows.length > 5000) return { notice: "5 000 lignes au plus par fichier." };
  const { data: result, error } = await supabase.rpc("admin_import_competitor_prices", { p_rows: rows });
  if (error) {
    console.error("Pricing (CSV) :", error.message);
    return { notice: "L'import n'a pas abouti : vérifiez le format (prix avec virgule ou point)." };
  }
  refresh();
  const r = result as { importes: number; ignores: number };
  return { ok: true, notice: `${r.importes} prix importés, ${r.ignores} ligne(s) ignorée(s) (EAN ou concurrent inconnu).` };
}

const settingsSchema = z.object({
  stripe_pct: z.coerce.number().min(0).max(10),
  stripe_fixed_cents: z.coerce.number().int().min(0).max(500),
  packaging_cents: z.coerce.number().int().min(0).max(5000),
  dropship_fee_cents: z.coerce.number().int().min(0).max(10000),
  aftersale_pct: z.coerce.number().min(0).max(20),
  target_below_min_pct: z.coerce.number().min(0).max(30),
  target_below_max_pct: z.coerce.number().min(0).max(30),
  auto_apply_max_pct: z.coerce.number().min(0).max(30),
  supplier_promo_drop_pct: z.coerce.number().min(1).max(60),
});

export async function saveSettings(_prev: ActionState, data: FormData): Promise<ActionState> {
  const supabase = await admin();
  const raw = Object.fromEntries(data);
  const cents = (k: string) => String(Math.round(Number(String(raw[k] ?? "0").replace(",", ".")) * 100));
  const parsed = settingsSchema.safeParse({
    ...Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v).replace(",", ".")])),
    stripe_fixed_cents: cents("stripe_fixed"),
    packaging_cents: cents("packaging"),
    dropship_fee_cents: cents("dropship_fee"),
  });
  if (!parsed.success) return { notice: "Valeur invalide : vérifiez les pourcentages et montants." };
  if (parsed.data.target_below_min_pct > parsed.data.target_below_max_pct) return { notice: "La bande « de … à … » est inversée." };
  const { error } = await supabase.rpc("admin_update_pricing_settings", { p: parsed.data });
  if (error) return { notice: "L'enregistrement n'a pas abouti." };
  await supabase.rpc("admin_run_pricing");
  refresh();
  revalidatePath("/admin/concurrents");
  return { ok: true, notice: "Réglages enregistrés, suggestions recalculées." };
}

export async function markAlertsRead(data: FormData) {
  const supabase = await admin();
  const ids = data.getAll("id").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const query = supabase.from("pricing_alerts").update({ read_at: new Date().toISOString() }).is("read_at", null);
  await (ids.length ? query.in("id", ids) : query);
  revalidatePath("/admin/alertes");
  revalidatePath("/admin", "layout");
}

export async function toggleCompetitor(data: FormData) {
  const supabase = await admin();
  const id = Number(data.get("id"));
  if (!Number.isInteger(id)) return;
  await supabase.from("competitors").update({ active: data.get("active") === "1" }).eq("id", id);
  revalidatePath("/admin/concurrents");
}
