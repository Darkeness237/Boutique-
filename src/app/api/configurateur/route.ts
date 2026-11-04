import { NextResponse, type NextRequest } from "next/server";
import { inStock } from "@/lib/catalog";
import { STEPS } from "@/lib/configurator";

// Pièces compatibles et en stock pour une étape du configurateur. Tous les filtres sont validés ici :
// le navigateur ne choisit que parmi des valeurs connues.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const step = STEPS.find((s) => s.key === q.get("etape"));
  if (!step) return NextResponse.json({ error: "Étape inconnue." }, { status: 400 });

  const socket = q.get("socket");
  const memory = q.get("memoire");
  const watts = Number(q.get("watts"));
  const sub = q.get("sous");
  const filters = {
    socket: step.key === "board" && socket && /^(AM4|AM5|LGA1700|LGA1851)$/.test(socket) ? socket : undefined,
    memory: (step.key === "board" || step.key === "ram") && memory && /^DDR[45]$/.test(memory) ? memory : undefined,
    minPsuWatts: step.key === "psu" && Number.isInteger(watts) && watts >= 300 && watts <= 2000 ? watts : undefined,
  };
  const subs = step.subcategories ?? [null];
  const wanted = sub && step.subcategories?.includes(sub) ? [sub] : subs;

  try {
    const lists = await Promise.all(
      wanted.map((s) =>
        inStock(step.category, { ...filters, subcategory: s ?? undefined, minPriceCents: step.key === "ram" ? 2000 : 500 }, 60),
      ),
    );
    // Les produits avec photo d'abord, puis par prix croissant.
    const items = lists
      .flat()
      .filter((p) => step.key !== "cpu" || p.socket)
      .filter((p) => !(p.subcategory && step.skipSubs?.includes(p.subcategory)) && !step.skipName?.test(p.name))
      .sort((a, b) => Number(!!b.image_url) - Number(!!a.image_url) || a.price_cents - b.price_cents)
      .slice(0, 80);
    return NextResponse.json(items, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch {
    return NextResponse.json({ error: "Catalogue indisponible." }, { status: 503 });
  }
}
