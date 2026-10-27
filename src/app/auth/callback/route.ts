import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseForUser } from "@/lib/supabase-server";

const OTP_TYPES = new Set<EmailOtpType>(["signup", "email", "recovery", "email_change", "invite", "magiclink"]);

// Retour de Google ou du lien de confirmation envoyé par e-mail : on ouvre la session puis on
// envoie le client sur son compte. La destination est fixe (pas de paramètre de redirection libre).
export async function GET(request: NextRequest) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const supabase = await supabaseForUser();

  let ok = false;
  if (code && code.length < 200) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && tokenHash.length < 200 && type && OTP_TYPES.has(type)) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }
  return NextResponse.redirect(ok ? `${site}/compte?bienvenue=1` : `${site}/connexion?erreur=lien`);
}
