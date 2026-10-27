import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// CSP stricte avec un nonce par requête : seuls les scripts émis par Next.js
// (qui reçoivent ce nonce) peuvent s'exécuter. Bloque l'essentiel des attaques XSS.
export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV !== "production";

  const csp = [
    "default-src 'self'",
    // 'unsafe-eval' uniquement en développement (requis par le rechargement à chaud de React).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Styles inline autorisés : Next.js en injecte ; le risque est faible comparé aux scripts.
    "style-src 'self' 'unsafe-inline'",
    // Photos produits servies par le CDN d'Open Icecat.
    "img-src 'self' data: blob: https://images.icecat.biz",
    "font-src 'self'",
    // À élargir quand Supabase et Stripe seront branchés (leurs domaines exacts, rien de plus).
    "connect-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  // Premier passage : on devine le pays de livraison (Cameroun ou France) d'après la géolocalisation
  // fournie par l'hébergeur ou la langue du navigateur. Le visiteur peut changer ensuite.
  let market: string | null = null;
  if (!request.cookies.get("marche")) {
    market = guessCountry(request) === "CM" ? "cm" : "fr";
    requestHeaders.set("cookie", `${request.headers.get("cookie") ?? ""}; marche=${market}`.replace(/^; /, ""));
  }

  // Client connecté : on rafraîchit sa session (jeton court) avant que la page la lise.
  const refreshed = await refreshSession(request, requestHeaders, isDev);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const c of refreshed) response.cookies.set(c.name, c.value, c.options);
  response.headers.set("Content-Security-Policy", csp);
  if (market) {
    response.cookies.set("marche", market, { path: "/", maxAge: 31536000, sameSite: "lax", secure: !isDev });
  }
  return response;
}

type CookieToSet = { name: string; value: string; options: Parameters<NextResponse["cookies"]["set"]>[2] };

async function refreshSession(request: NextRequest, requestHeaders: Headers, isDev: boolean): Promise<CookieToSet[]> {
  if (!request.cookies.getAll().some((c) => /^sb-.+-auth-token/.test(c.name))) return [];
  const out: CookieToSet[] = [];
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          request.cookies.set(name, value);
          out.push({ name, value, options: { ...options, httpOnly: true } });
        }
      },
    },
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: !isDev },
  });
  try {
    await supabase.auth.getUser();
  } catch {
    // Supabase injoignable : la page s'affiche quand même, sans session.
  }
  if (out.length) requestHeaders.set("cookie", request.cookies.toString());
  return out;
}

function guessCountry(request: NextRequest): string | null {
  // Netlify transmet la géolocalisation dans un en-tête JSON encodé en base64.
  const geo = request.headers.get("x-nf-geo");
  if (geo) {
    try {
      const code = JSON.parse(atob(geo))?.country?.code;
      if (typeof code === "string") return code.toUpperCase();
    } catch {
      // En-tête illisible : on passe à l'indice suivant.
    }
  }
  const country = request.headers.get("x-country");
  if (country) return country.toUpperCase();
  return /\b[a-z]{2}-CM\b/i.test(request.headers.get("accept-language") ?? "") ? "CM" : null;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
