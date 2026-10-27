import { cache } from "react";
import { supabase } from "./supabase";
import type { Product } from "./product";

export type Category = { slug: string; name: string; hint: string };

export type { Product } from "./product";
export { displayName } from "./product";

export const PRODUCT_COLUMNS =
  "id, slug, name, brand, category_slug, price_cents, in_stock, lead_days, socket, memory, psu_watts, image_url";

export const PAGE_SIZE = 24;

const SLUG_RE = /^[a-z0-9-]{1,200}$/;

function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) {
    // Message détaillé dans les journaux serveur, jamais renvoyé au visiteur.
    console.error(`Supabase (${what}) :`, result.error.message);
    throw new Error("Le catalogue est momentanément indisponible.");
  }
  return result.data as T;
}

export const getCategories = cache(async (): Promise<Category[]> => {
  const res = await supabase.from("categories").select("slug, name, hint").order("sort");
  return must(res, "catégories");
});

export async function getCategory(slug: string): Promise<Category | undefined> {
  return (await getCategories()).find((c) => c.slug === slug);
}

export const getProductBySlug = cache(async (slug: string): Promise<Product | null> => {
  if (!SLUG_RE.test(slug)) return null;
  const res = await supabase.from("products").select(PRODUCT_COLUMNS).eq("slug", slug).eq("active", true).maybeSingle();
  return must(res, "produit");
});

export async function getProductsByIds(ids: number[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const res = await supabase.from("products").select(PRODUCT_COLUMNS).in("id", ids.slice(0, 50)).eq("active", true);
  return must(res, "produits par id");
}

export const getBrands = cache(async (category?: string): Promise<string[]> => {
  const res = await supabase.rpc("category_brands", { p_category: category ?? null });
  return must<{ brand: string }[]>(res, "marques").map((r) => r.brand);
});

export type Sort = "pertinence" | "prix-croissant" | "prix-decroissant";

export type Search = {
  category?: string;
  q?: string;
  brands?: string[];
  maxPriceCents?: number;
  inStockOnly?: boolean;
  sort?: Sort;
  page?: number;
};

export async function searchProducts(s: Search): Promise<{ items: Product[]; total: number }> {
  const page = Math.max(1, s.page ?? 1);
  let query = supabase.from("products").select(PRODUCT_COLUMNS, { count: "exact" }).eq("active", true);
  if (s.category) query = query.eq("category_slug", s.category);
  if (s.brands?.length) query = query.in("brand", s.brands);
  if (s.maxPriceCents) query = query.lte("price_cents", s.maxPriceCents);
  if (s.inStockOnly) query = query.eq("in_stock", true);
  for (const term of searchTerms(s.q)) query = query.ilike("name", `%${term}%`);

  if (s.sort === "prix-croissant") query = query.order("price_cents");
  else if (s.sort === "prix-decroissant") query = query.order("price_cents", { ascending: false });
  else query = query.order("in_stock", { ascending: false }).order("price_cents");

  const from = (page - 1) * PAGE_SIZE;
  const res = await query.range(from, from + PAGE_SIZE - 1);
  const items = must(res, "recherche");
  return { items, total: res.count ?? items.length };
}

/** Découpe la recherche en mots, sans les caractères spéciaux des filtres SQL. */
function searchTerms(q?: string): string[] {
  if (!q) return [];
  return q
    .replace(/[%_*,()\\]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .slice(0, 5);
}

export type StockFilter = Partial<Pick<Product, "socket" | "memory">> & {
  minPriceCents?: number;
  minPsuWatts?: number;
  nameMatches?: string[];
};

/** Produits en stock d'une catégorie, triés par prix (pour les sélections de l'accueil). */
export async function inStock(category: string, f: StockFilter = {}, limit = 60): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("active", true)
    .eq("in_stock", true)
    .eq("category_slug", category);
  if (f.socket) query = query.eq("socket", f.socket);
  if (f.memory) query = query.eq("memory", f.memory);
  if (f.minPriceCents) query = query.gte("price_cents", f.minPriceCents);
  if (f.minPsuWatts) query = query.gte("psu_watts", f.minPsuWatts);
  // Motifs fixés dans le code (jamais issus d'une saisie) : au moins un doit correspondre.
  if (f.nameMatches?.length) query = query.or(f.nameMatches.map((m) => `name.ilike.*${m}*`).join(","));
  const res = await query.order("price_cents").limit(limit);
  return must(res, "stock");
}
