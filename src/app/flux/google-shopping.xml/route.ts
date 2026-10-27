import { FREE_SHIPPING_CENTS, SHIPPING_CENTS } from "@/lib/cart";
import { allProducts } from "@/lib/feed";
import { activePromo, displayName } from "@/lib/product";
import { gtin, productDescription, siteUrl } from "@/lib/seo";

// Flux produits pour Google Merchant Center : annonces gratuites dans l'onglet Shopping, puis
// campagnes Shopping / Performance Max. Seuls les produits en stock et avec photo y figurent.
export const revalidate = 3600;

const GOOGLE_CATEGORY: Record<string, string> = {
  processeurs: "Electronics > Electronics Accessories > Computer Components > Computer Processors",
  "cartes-graphiques": "Electronics > Electronics Accessories > Computer Components > I/O Cards & Adapters > Video Cards & Adapters",
  "cartes-meres": "Electronics > Electronics Accessories > Computer Components > Motherboards",
  memoire: "Electronics > Electronics Accessories > Computer Components > Computer Memory",
  stockage: "Electronics > Electronics Accessories > Computer Components > Storage Devices",
  alimentations: "Electronics > Electronics Accessories > Computer Components > Power Supplies",
  boitiers: "Electronics > Electronics Accessories > Computer Components > Computer Cases",
  refroidissement: "Electronics > Electronics Accessories > Computer Components > Computer Cooling",
  ecrans: "Electronics > Video > Computer Monitors",
  peripheriques: "Electronics > Electronics Accessories > Computer Components > Input Devices",
  fauteuils: "Furniture > Chairs > Gaming Chairs",
};

const xml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
const eur = (cents: number) => `${(cents / 100).toFixed(2)} EUR`;

export async function GET() {
  const site = siteUrl();
  const products = await allProducts({ inStockWithImage: true });
  const items = products
    .filter((p) => p.image_url)
    .map((p) => {
      const promo = activePromo(p);
      const fields: [string, string][] = [
        ["g:id", String(p.id)],
        ["g:title", `${p.brand} ${displayName(p)}`.slice(0, 150)],
        ["g:description", productDescription(p, 5000)],
        ["g:link", `${site}/produit/${p.slug}`],
        ["g:image_link", p.image_url!],
        ["g:availability", "in_stock"],
        ["g:condition", "new"],
        ["g:brand", p.brand],
        ["g:price", eur(promo ? promo.reference : p.price_cents)],
        ...(promo
          ? ([
              ["g:sale_price", eur(promo.price)],
              ["g:sale_price_effective_date", `${new Date().toISOString().slice(0, 10)}T00:00:00+01:00/${promo.endsAt}`],
            ] as [string, string][])
          : []),
        ...(gtin(p) ? ([["g:gtin", gtin(p)!]] as [string, string][]) : [["g:identifier_exists", "no"] as [string, string]]),
        ...(GOOGLE_CATEGORY[p.category_slug] ? ([["g:google_product_category", GOOGLE_CATEGORY[p.category_slug]]] as [string, string][]) : []),
        ["g:product_type", p.category_slug],
      ];
      const price = promo ? promo.price : p.price_cents;
      const shipping = `<g:shipping><g:country>FR</g:country><g:price>${eur(price >= FREE_SHIPPING_CENTS ? 0 : SHIPPING_CENTS)}</g:price></g:shipping>`;
      return `<item>${fields.map(([k, v]) => `<${k}>${xml(v)}</${k}>`).join("")}${shipping}</item>`;
    });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>
<title>Silicium</title><link>${site}</link><description>Composants PC et matériel gaming</description>
${items.join("\n")}
</channel></rss>`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
