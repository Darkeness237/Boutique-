import { NextResponse, type NextRequest } from "next/server";
import { getProductsByIds } from "@/lib/catalog";

// Renvoie les prix et la disponibilité des articles du panier.
// Entrée : ?ids=12,34,56 (50 identifiants numériques au plus). Tout le reste est rejeté.
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("ids") ?? "";
  if (raw.length > 700 || !/^\d{1,12}(,\d{1,12}){0,49}$/.test(raw)) {
    return NextResponse.json({ error: "Paramètre ids invalide." }, { status: 400 });
  }
  const ids = [...new Set(raw.split(",").map(Number))];
  try {
    const products = await getProductsByIds(ids);
    return NextResponse.json(products, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Catalogue indisponible." }, { status: 503 });
  }
}
