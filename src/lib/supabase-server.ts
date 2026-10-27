import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase lié à la session du visiteur (cookies). Utilisé uniquement côté serveur :
 * le navigateur ne parle jamais directement à Supabase, et les cookies de session sont httpOnly.
 */
export async function supabaseForUser() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, { ...options, httpOnly: true });
        } catch {
          // Appel depuis un composant serveur : les cookies ne peuvent pas y être écrits,
          // le middleware se charge alors de rafraîchir la session.
        }
      },
    },
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

/** Utilisateur connecté (vérifié auprès de Supabase), ou null. */
export async function currentUser() {
  if (!(await hasSessionCookie())) return null;
  const { data } = await (await supabaseForUser()).auth.getUser();
  return data.user;
}

/** Présence d'un cookie de session, sans appel réseau (pour l'en-tête du site). */
export async function hasSessionCookie(): Promise<boolean> {
  return (await cookies()).getAll().some((c) => /^sb-.+-auth-token/.test(c.name));
}
