import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/public-sans";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartProvider } from "@/components/CartProvider";

export const metadata: Metadata = {
  title: {
    default: "Silicium · Composants PC et matériel gaming",
    template: "%s · Silicium",
  },
  description:
    "Processeurs, cartes graphiques, cartes mères et périphériques gaming. Compatibilité vérifiée sur chaque fiche, livraison en France.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  themeColor: "#f2f3f5",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Lire les en-têtes rend chaque page dynamique : indispensable pour que Next.js
  // applique le nonce CSP généré par le middleware à ses propres scripts.
  await headers();

  return (
    <html lang="fr">
      <body>
        <CartProvider>
          <Header />
          <main id="contenu">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
