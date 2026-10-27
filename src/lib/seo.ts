import { FREE_SHIPPING_CENTS, SHIPPING_CENTS } from "./cart";
import { activePromo, displayName, effectivePrice, type Product } from "./product";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Description courte d'un produit (fiche, partage sur les réseaux, flux Google). */
export function productDescription(p: Product, max = 300): string {
  const specs = Array.isArray(p.specs) ? p.specs : [];
  const points = specs
    .filter(([label]) => !/^(marque|couleur|poids|largeur|hauteur|profondeur)/i.test(label))
    .slice(0, 6)
    .map(([label, value]) => `${label} : ${value}`);
  const text = [`${p.brand} ${displayName(p)}.`, ...points].join(" · ");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const GTIN_RE = /^\d{8,14}$/;
export function gtin(p: Product): string | null {
  return p.ean && GTIN_RE.test(p.ean) ? p.ean : null;
}

/** Données structurées schema.org (fiches produits enrichies dans Google : prix, stock, livraison). */
export function productJsonLd(p: Product) {
  const url = `${siteUrl()}/produit/${p.slug}`;
  const price = effectivePrice(p);
  const promo = activePromo(p);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${p.brand} ${displayName(p)}`,
    description: productDescription(p, 1000),
    ...(p.image_url ? { image: [p.image_url] } : {}),
    brand: { "@type": "Brand", name: p.brand },
    ...(gtin(p) ? { gtin: gtin(p) } : {}),
    sku: String(p.id),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "EUR",
      price: (price / 100).toFixed(2),
      ...(promo && p.promo_ends_at ? { priceValidUntil: p.promo_ends_at.slice(0, 10) } : {}),
      availability: p.in_stock ? "https://schema.org/InStock" : "https://schema.org/BackOrder",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "Silicium" },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          value: price >= FREE_SHIPPING_CENTS ? "0" : (SHIPPING_CENTS / 100).toFixed(2),
          currency: "EUR",
        },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "FR" },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: Math.max(1, p.lead_days), unitCode: "DAY" },
          transitTime: { "@type": "QuantitativeValue", minValue: 2, maxValue: 4, unitCode: "DAY" },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "FR",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 14,
        returnMethod: "https://schema.org/ReturnByMail",
      },
    },
  };
}

/** JSON sûr à placer dans une balise <script> (empêche de fermer la balise depuis les données). */
export function jsonForScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
