import { supabase } from "./supabase";
import { PRODUCT_COLUMNS, type Product } from "./catalog";

/** Tous les produits actifs, page par page . */
export async function allProducts(opts: { inStockWithImage?: boolean } = {}): Promise<Product[]> {
  const out: Product[] = [];
  // Pages de 400 lignes : chaque réponse reste sous la limite de 2 Mo du cache de Next.js.
  for (let from = 0; from < 50_000; from += 400) {
    let q = supabase.from("products").select(PRODUCT_COLUMNS).eq("active", true);
    if (opts.inStockWithImage) q = q.eq("in_stock", true).eq("has_image", true);
    const { data, error } = await q.order("id").range(from, from + 399);
    if (error) throw new Error(`Flux produits : ${error.message}`);
    out.push(...data);
    if (data.length < 400) break;
  }
  return out;
}

/** Adresses des fiches pour le plan du site (colonnes minimales). */
export async function allSlugs(): Promise<{ slug: string; in_stock: boolean }[]> {
  const out: { slug: string; in_stock: boolean }[] = [];
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await supabase
      .from("products")
      .select("slug, in_stock")
      .eq("active", true)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(`Plan du site : ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
