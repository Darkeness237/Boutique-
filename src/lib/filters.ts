import { z } from "zod";
import type { Sort } from "./catalog";

export const SORTS: Record<Sort, string> = {
  pertinence: "Pertinence",
  "prix-croissant": "Prix croissant",
  "prix-decroissant": "Prix décroissant",
};

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const many = (v: unknown) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

// Les paramètres d'URL sont des entrées utilisateur : on les valide et on ne garde que des
// valeurs connues (allowlist), sans jamais lever d'erreur pour une URL bricolée.
const schema = z.object({
  q: z.preprocess(one, z.string().trim().max(80).optional().catch(undefined)),
  marque: z.preprocess(many, z.array(z.string().max(80)).max(20).catch([])),
  prixMax: z.preprocess(one, z.coerce.number().int().min(1).max(50_000_000).optional().catch(undefined)),
  dispo: z.preprocess(one, z.literal("1").optional().catch(undefined)),
  tri: z.preprocess(
    one,
    z.enum(Object.keys(SORTS) as [Sort, ...Sort[]]).optional().catch(undefined),
  ),
  page: z.preprocess(one, z.coerce.number().int().min(1).max(500).optional().catch(undefined)),
  sous: z.preprocess(one, z.string().max(40).optional().catch(undefined)),
  promo: z.preprocess(one, z.literal("1").optional().catch(undefined)),
});

export type Filters = {
  q?: string;
  marque: string[];
  prixMax?: number;
  dispo: boolean;
  tri: Sort;
  page: number;
  sous?: string;
  promo: boolean;
};

export function parseFilters(
  params: Record<string, string | string[] | undefined>,
  allowedBrands: string[],
  allowedSubs: string[] = [],
): Filters {
  const parsed = schema.parse(params);
  return {
    q: parsed.q || undefined,
    marque: parsed.marque.filter((b) => allowedBrands.includes(b)),
    prixMax: parsed.prixMax,
    dispo: parsed.dispo === "1",
    tri: parsed.tri ?? "pertinence",
    page: parsed.page ?? 1,
    sous: parsed.sous && allowedSubs.includes(parsed.sous) ? parsed.sous : undefined,
    promo: parsed.promo === "1",
  };
}

/** Reconstruit l'URL d'une page de résultats en gardant les filtres actifs. */
export function filtersToQuery(f: Filters, page: number): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  for (const b of f.marque) p.append("marque", b);
  if (f.prixMax) p.set("prixMax", String(f.prixMax));
  if (f.dispo) p.set("dispo", "1");
  if (f.tri !== "pertinence") p.set("tri", f.tri);
  if (f.sous) p.set("sous", f.sous);
  if (f.promo) p.set("promo", "1");
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `?${s}` : "";
}
