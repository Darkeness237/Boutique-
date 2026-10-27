import { NextResponse, type NextRequest } from "next/server";

// CSP stricte avec un nonce par requête : seuls les scripts émis par Next.js
// (qui reçoivent ce nonce) peuvent s'exécuter. Bloque l'essentiel des attaques XSS.
export function middleware(request: NextRequest) {
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

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (market) {
    response.cookies.set("marche", market, { path: "/", maxAge: 31536000, sameSite: "lax", secure: !isDev });
  }
  return response;
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
