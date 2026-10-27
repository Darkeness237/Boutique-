import { cache } from "react";
import { supabase } from "./supabase";
import type { Product } from "./product";

export type Category = { slug: string; name: string; hint: string };
export type Subcategory = { slug: string; name: string; count: number };
export type CategoryNode = { slug: string; name: string; count: number; subs: Subcategory[] };

export type { Product } from "./product";
export { activePromo, displayName, effectivePrice } from "./product";

// Une seule chaîne littérale : le client Supabase en déduit le type des lignes.
export const PRODUCT_COLUMNS =
  "id, slug, name, brand, category_slug, subcategory, price_cents, in_stock, lead_days, socket, memory, psu_watts, image_url, specs, media_source, promo_price_cents, promo_label, promo_ends_at, reference_price_cents";

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

/** Catégories et sous-catégories avec leur nombre de produits (menu latéral). */
export const getCategoryTree = cache(async (): Promise<CategoryNode[]> => {
  type Row = { category_slug: string; category_name: string; sub_slug: string | null; sub_name: string | null; products: number };
  const rows = must<Row[]>(await supabase.rpc("category_tree"), "arbre des catégories");
  const tree: CategoryNode[] = [];
  for (const r of rows) {
    let node = tree.find((n) => n.slug === r.category_slug);
    if (!node) {
      node = { slug: r.category_slug, name: r.category_name, count: 0, subs: [] };
      tree.push(node);
    }
    if (r.sub_slug && r.sub_name) node.subs.push({ slug: r.sub_slug, name: r.sub_name, count: Number(r.products) });
    else node.count = Number(r.products);
  }
  // Une catégorie avec sous-catégories n'a pas de ligne « total » : on additionne ses sous-catégories.
  for (const n of tree) if (n.subs.length && !n.count) n.count = n.subs.reduce((s, x) => s + x.count, 0);
  return tree;
});

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

/** Marques les plus représentées (pour le bandeau de l'accueil). */
export const getTopBrands = cache(async (n: number): Promise<string[]> => {
  const res = await supabase.rpc("category_brands", { p_category: null });
  return must<{ brand: string; products: number }[]>(res, "marques")
    .sort((a, b) => b.products - a.products)
    .slice(0, n)
    .map((r) => r.brand);
});

export type Sort = "pertinence" | "prix-croissant" | "prix-decroissant";

export type Search = {
  category?: string;
  subcategory?: string;
  q?: string;
  brands?: string[];
  maxPriceCents?: number;
  inStockOnly?: boolean;
  promoOnly?: boolean;
  sort?: Sort;
  page?: number;
};

export async function searchProducts(s: Search): Promise<{ items: Product[]; total: number }> {
  const page = Math.max(1, s.page ?? 1);
  let query = supabase.from("products").select(PRODUCT_COLUMNS, { count: "exact" }).eq("active", true);
  if (s.category) query = query.eq("category_slug", s.category);
  if (s.subcategory) query = query.eq("subcategory", s.subcategory);
  if (s.brands?.length) query = query.in("brand", s.brands);
  if (s.maxPriceCents) query = query.lte("price_cents", s.maxPriceCents);
  if (s.inStockOnly) query = query.eq("in_stock", true);
  if (s.promoOnly) query = query.not("promo_price_cents", "is", null).gt("promo_ends_at", new Date().toISOString());
  for (const term of searchTerms(s.q)) query = query.ilike("name", `%${term}%`);

  if (s.sort === "prix-croissant") query = query.order("price_cents");
  else if (s.sort === "prix-decroissant") query = query.order("price_cents", { ascending: false });
  else query = query.order("in_stock", { ascending: false }).order("has_image", { ascending: false }).order("price_cents");

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

export type StockFilter = Partial<Pick<Product, "socket" | "memory" | "subcategory">> & {
  minPriceCents?: number;
  maxPriceCents?: number;
  minPsuWatts?: number;
  nameMatches?: string[];
  withImage?: boolean;
  promoOnly?: boolean;
  excludeId?: number;
};

/** Produits en stock d'une catégorie (ou de toutes), triés par prix croissant. */
export async function inStock(category: string | null, f: StockFilter = {}, limit = 60): Promise<Product[]> {
  let query = supabase.from("products").select(PRODUCT_COLUMNS).eq("active", true).eq("in_stock", true);
  if (category) query = query.eq("category_slug", category);
  if (f.subcategory) query = query.eq("subcategory", f.subcategory);
  if (f.socket) query = query.eq("socket", f.socket);
  if (f.memory) query = query.eq("memory", f.memory);
  if (f.minPriceCents) query = query.gte("price_cents", f.minPriceCents);
  if (f.maxPriceCents) query = query.lte("price_cents", f.maxPriceCents);
  if (f.minPsuWatts) query = query.gte("psu_watts", f.minPsuWatts);
  if (f.withImage) query = query.not("image_url", "is", null);
  if (f.promoOnly) query = query.not("promo_price_cents", "is", null).gt("promo_ends_at", new Date().toISOString());
  if (f.excludeId) query = query.neq("id", f.excludeId);
  // Motifs fixés dans le code (jamais issus d'une saisie) : au moins un doit correspondre.
  if (f.nameMatches?.length) query = query.or(f.nameMatches.map((m) => `name.ilike.*${m}*`).join(","));
  const res = await query.order("price_cents").limit(limit);
  return must(res, "stock");
}
