import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY sont requis.");
}

// Clé publique : elle ne donne accès qu'au catalogue (prix de vente), jamais aux prix d'achat.
// Les réponses sont gardées 5 minutes en cache : le catalogue change au rythme des imports.
export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init) => fetch(input, { ...init, next: { revalidate: 300 } }),
  },
});
