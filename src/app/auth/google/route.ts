import { NextResponse } from "next/server";
import { supabaseForUser } from "@/lib/supabase-server";

// « Continuer avec Google » : lien GET vers cette route, qui redirige vers Google.
// Le vérificateur PKCE est gardé dans un cookie httpOnly jusqu'au retour sur /auth/callback.
export async function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await supabaseForUser();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${site}/auth/callback`, skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    console.error("Google :", error?.message);
    return NextResponse.redirect(`${site}/connexion?erreur=google`);
  }
  return NextResponse.redirect(data.url);
}
