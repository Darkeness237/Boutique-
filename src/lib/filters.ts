import { z } from "zod";
import { brands, type Product } from "./catalog";

export const SORTS = {
  pertinence: "Pertinence",
  "prix-croissant": "Prix croissant",
  "prix-decroissant": "Prix décroissant",
} as const;

type Sort = keyof typeof SORTS;

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const many = (v: unknown) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

// Les paramètres d'URL sont des entrées utilisateur : on les valide et on ne garde
// que des valeurs connues (allowlist), sans jamais lever d'erreur pour une URL bricolée.
const schema = z.object({
  q: z.preprocess(one, z.string().trim().max(80).optional().catch(undefined)),
  marque: z.preprocess(
    many,
    z
      .array(z.string())
      .max(20)
      .transform((list) => list.filter((b) => brands.includes(b)))
      .catch([]),
  ),
  prixMax: z.preprocess(one, z.coerce.number().int().min(1).max(10000).optional().catch(undefined)),
  dispo: z.preprocess(one, z.literal("1").optional().catch(undefined)),
  tri: z.preprocess(
    one,
    z
      .enum(Object.keys(SORTS) as [Sort, ...Sort[]])
      .optional()
      .catch(undefined),
  ),
});

export type Filters = {
  q?: string;
  marque: string[];
  prixMax?: number;
  dispo: boolean;
  tri: Sort;
};

export function parseFilters(params: Record<string, string | string[] | undefined>): Filters {
  const parsed = schema.parse(params);
  return {
    q: parsed.q || undefined,
    marque: parsed.marque,
    prixMax: parsed.prixMax,
    dispo: parsed.dispo === "1",
    tri: parsed.tri ?? "pertinence",
  };
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function applyFilters(list: Product[], f: Filters): Product[] {
  const terms = f.q ? normalize(f.q).split(/\s+/).filter(Boolean) : [];
  const result = list.filter((p) => {
    if (f.marque.length && !f.marque.includes(p.brand)) return false;
    if (f.prixMax && p.priceCents > f.prixMax * 100) return false;
    if (f.dispo && p.stock <= 0) return false;
    if (terms.length) {
      const haystack = normalize(`${p.brand} ${p.name} ${p.keySpec} ${p.socket ?? ""}`);
      if (!terms.every((t) => haystack.includes(t))) return false;
    }
    return true;
  });
  if (f.tri === "prix-croissant") result.sort((a, b) => a.priceCents - b.priceCents);
  if (f.tri === "prix-decroissant") result.sort((a, b) => b.priceCents - a.priceCents);
  return result;
}
