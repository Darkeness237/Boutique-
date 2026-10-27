import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { cartSchema, FREE_SHIPPING_CENTS, SHIPPING_CENTS } from "@/lib/cart";
import { displayName, getProductsByIds } from "@/lib/catalog";
import { effectivePrice } from "@/lib/product";
import { MARKET_COOKIE, parseMarket } from "@/lib/market";
import { INTEGRATION_ID, stripe } from "@/lib/stripe";
import { currentUser } from "@/lib/supabase-server";

const bodySchema = z.object({ lines: cartSchema.min(1) });

// Crée la page de paiement Stripe. Le navigateur n'envoie que des identifiants et des quantités :
// les prix, la disponibilité et la livraison sont recalculés ici, à partir de la base.
export async function POST(request: NextRequest) {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) return NextResponse.json({ error: "Configuration incomplète." }, { status: 500 });

  // Refuse les appels venant d'un autre site.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(site).origin && !origin.startsWith("http://localhost")) {
    return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  }

  if (parseMarket(request.cookies.get(MARKET_COOKIE)?.value) !== "fr") {
    return NextResponse.json(
      { error: "Le paiement pour le Cameroun (Orange Money, MTN MoMo) arrive bientôt." },
      { status: 400 },
    );
  }

  const raw = await request.text();
  if (raw.length > 5000) return NextResponse.json({ error: "Panier trop volumineux." }, { status: 413 });
  let parsed;
  try {
    parsed = bodySchema.safeParse(JSON.parse(raw));
  } catch {
    parsed = null;
  }
  if (!parsed?.success) return NextResponse.json({ error: "Panier invalide." }, { status: 400 });

  // Une ligne par produit (deux lignes du même produit sont regroupées).
  const qtyById = new Map<number, number>();
  for (const l of parsed.data.lines) qtyById.set(Number(l.id), Math.min(10, (qtyById.get(Number(l.id)) ?? 0) + l.qty));

  let products;
  try {
    products = await getProductsByIds([...qtyById.keys()]);
  } catch {
    return NextResponse.json({ error: "Catalogue indisponible, réessayez dans un instant." }, { status: 503 });
  }
  if (products.length !== qtyById.size || products.some((p) => !p.in_stock)) {
    return NextResponse.json(
      { error: "Un article n'est plus disponible : retirez-le du panier pour continuer." },
      { status: 409 },
    );
  }

  const subtotal = products.reduce((s, p) => s + effectivePrice(p) * (qtyById.get(p.id) ?? 0), 0);
  const shipping = subtotal >= FREE_SHIPPING_CENTS ? 0 : SHIPPING_CENTS;

  // Client connecté : e-mail pré-rempli et commande rattachée à son compte.
  const user = await currentUser().catch(() => null);

  try {
    const session = await stripe().checkout.sessions.create({
      ...(user?.email ? { customer_email: user.email } : {}),
      mode: "payment",
      locale: "fr",
      integration_identifier: INTEGRATION_ID,
      line_items: products.map((p) => ({
        quantity: qtyById.get(p.id) ?? 1,
        price_data: {
          currency: "eur",
          unit_amount: effectivePrice(p),
          product_data: {
            name: `${p.brand} ${displayName(p)}`.slice(0, 250),
            ...(p.image_url ? { images: [p.image_url] } : {}),
            metadata: { product_id: String(p.id) },
          },
        },
      })),
      shipping_address_collection: { allowed_countries: ["FR"] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: shipping === 0 ? "Livraison à domicile offerte" : "Livraison à domicile",
            fixed_amount: { amount: shipping, currency: "eur" },
            delivery_estimate: {
              minimum: { unit: "business_day", value: 3 },
              maximum: { unit: "business_day", value: 6 },
            },
          },
        },
      ],
      phone_number_collection: { enabled: true },
      custom_text: { submit: { message: "TVA non applicable, art. 293 B du CGI." } },
      metadata: { market: "fr", ...(user ? { user_id: user.id } : {}) },
      success_url: `${site}/commande/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/panier`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("Stripe (création du paiement) :", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Le paiement n'a pas pu démarrer. Réessayez dans un instant." }, { status: 502 });
  }
}
