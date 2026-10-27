import type { MetadataRoute } from "next";
import { getCategories } from "@/lib/catalog";
import { allSlugs } from "@/lib/feed";
import { siteUrl } from "@/lib/seo";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = siteUrl();
  const [categories, products] = await Promise.all([getCategories(), allSlugs()]);
  return [
    { url: `${site}/`, changeFrequency: "daily", priority: 1 },
    { url: `${site}/catalogue`, changeFrequency: "daily", priority: 0.8 },
    ...categories.map((c) => ({ url: `${site}/catalogue/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...products.map((p) => ({
      url: `${site}/produit/${p.slug}`,
      changeFrequency: "weekly" as const,
      priority: p.in_stock ? 0.6 : 0.3,
    })),
  ];
}
