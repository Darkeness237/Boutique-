import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/public-sans";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartProvider } from "@/components/CartProvider";
import { Ticker } from "@/components/Ticker";
import { FREE_SHIPPING_CENTS } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { MarketProvider } from "@/components/MarketProvider";
import { getMarket } from "@/lib/market-server";

export const metadata: Metadata = {
  title: {
    default: "Silicium · Composants PC et matériel gaming",
    template: "%s · Silicium",
  },
  description:
    "Processeurs, cartes graphiques, cartes mères et périphériques gaming. Compatibilité vérifiée sur chaque fiche, livraison en France et au Cameroun.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  themeColor: "#f2f3f5",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Lire les en-têtes rend chaque page dynamique : indispensable pour que Next.js
  // applique le nonce CSP généré par le middleware à ses propres scripts.
  await headers();
  const market = await getMarket();

  const promises =
    market === "cm"
      ? [
          "Livré chez vous à Douala et Yaoundé",
          "Prix tout compris : transport, douane et TVA inclus",
          "Paiement par Orange Money et MTN MoMo",
          "Compatibilité vérifiée sur chaque config",
          "Garantie de 2 ans",
          "Expédié depuis la France par avion",
        ]
      : [
          `Livraison offerte dès ${formatPrice(FREE_SHIPPING_CENTS)}`,
          "Compatibilité vérifiée sur chaque config",
          "14 jours pour changer d'avis",
          "Garantie légale de 2 ans",
          "Paiement sécurisé par Stripe",
          "Des milliers de pièces en stock",
        ];

  return (
    <html lang="fr">
      <body>
        <MarketProvider market={market}>
          <CartProvider>
            <Ticker label="Nos engagements" items={promises} />
            <Header />
            <main id="contenu">{children}</main>
            <Footer />
          </CartProvider>
        </MarketProvider>
      </body>
    </html>
  );
}
