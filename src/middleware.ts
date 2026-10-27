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

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
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
