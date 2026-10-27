import Stripe from "stripe";

// Client Stripe côté serveur uniquement. La clé (restreinte, `rk_…`) vit dans les variables
// d'environnement de Netlify : jamais dans le code ni dans le navigateur.
let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY manquante");
    // Client HTTP basé sur fetch : standard, compatible avec tous les hébergeurs et proxys.
    client = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
  }
  return client;
}

/** Libellé de suivi de ce parcours de paiement dans le tableau de bord Stripe. */
export const INTEGRATION_ID = "silicium-checkout-kqwmzrtd";
