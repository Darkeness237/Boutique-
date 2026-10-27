import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { recordPaidOrder } from "@/lib/orders";
import { stripe } from "@/lib/stripe";

// Événements Stripe. C'est ici, et seulement ici, qu'une commande est enregistrée :
// le client peut fermer son navigateur après avoir payé sans que la commande soit perdue.
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "Requête refusée." }, { status: 400 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    // Vérifie que l'événement vient bien de Stripe et n'a pas été modifié.
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      // Avec certains moyens de paiement, la session est terminée avant que l'argent soit reçu.
      if (session.payment_status === "unpaid") break;
      try {
        const number = await recordPaidOrder(await toOrder(session));
        console.log(`Commande ${number} enregistrée (${session.id})`);
      } catch (e) {
        console.error("Webhook :", e instanceof Error ? e.message : e);
        // Erreur 500 : Stripe renverra l'événement, et l'enregistrement est idempotent.
        return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 });
      }
      break;
    }
    case "checkout.session.async_payment_failed":
      console.warn(`Paiement différé échoué : ${event.data.object.id}`);
      break;
  }
  return NextResponse.json({ received: true });
}

async function toOrder(session: Stripe.Checkout.Session) {
  const lineItems = await stripe().checkout.sessions.listLineItems(session.id, {
    limit: 100,
    expand: ["data.price.product"],
  });
  const shipping = session.collected_information?.shipping_details;
  const address = shipping?.address;
  return {
    market: session.metadata?.market === "cm" ? ("cm" as const) : ("fr" as const),
    currency: session.currency === "xaf" ? ("xaf" as const) : ("eur" as const),
    subtotal: session.amount_subtotal ?? 0,
    shipping: session.total_details?.amount_shipping ?? 0,
    total: session.amount_total ?? 0,
    email: session.customer_details?.email ?? "",
    customer_name: shipping?.name ?? session.customer_details?.name ?? null,
    phone: session.customer_details?.phone ?? null,
    shipping_address: {
      line1: address?.line1 ?? null,
      line2: address?.line2 ?? null,
      postal_code: address?.postal_code ?? null,
      city: address?.city ?? null,
      country: address?.country ?? null,
    },
    stripe_session_id: session.id,
    stripe_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
    user_id: session.metadata?.user_id ?? null,
    items: lineItems.data.map((li) => {
      const product = li.price?.product;
      const productId = product && typeof product === "object" && "metadata" in product ? product.metadata?.product_id : null;
      return {
        product_id: productId && /^\d+$/.test(productId) ? Number(productId) : null,
        name: li.description ?? "Article",
        qty: li.quantity ?? 1,
        unit_price: li.price?.unit_amount ?? 0,
      };
    }),
  };
}
