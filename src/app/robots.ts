import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/", "/compte", "/panier", "/commande/", "/admin", "/transitaire"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
