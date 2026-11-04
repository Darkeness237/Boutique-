import Link from "next/link";
import { SelectAll } from "@/components/pricing/SelectAll";
import { decidePrices } from "@/lib/pricing-actions";
import {
  DECISIONS,
  PRICING_STATUS,
  SUGGESTION_COLUMNS,
  euros,
  pct,
  type Competitor,
  type Suggestion,
} from "@/lib/pricing";
import { supabaseForUser } from "@/lib/supabase-server";

const VIEWS = [
  { key: "a-valider", label: "À valider", filter: { decision: "a_valider" } },
  { key: "trop-cher", label: "⚠️ Trop chers", filter: { status: "trop_cher" } },
  { key: "marge", label: "📉 Marge insuffisante", filter: { status: "marge_insuffisante" } },
  { key: "bien", label: "✅ Bien positionnés", filter: { status: "bien" } },
  { key: "competitif", label: "🔥 Très compétitifs", filter: { status: "tres_competitif" } },
  { key: "sans-donnees", label: "Sans données marché", filter: { status: "sans_donnees" } },
] as const;
const PAGE = 50;

type Props = { searchParams: Promise<{ vue?: string; q?: string; page?: string }> };

export default async function PricingDashboard({ searchParams }: Props) {
  const params = await searchParams;
  const view = VIEWS.find((v) => v.key === params.vue) ?? VIEWS[0];
  const q = (params.q ?? "").trim().slice(0, 80);
  const page = Math.max(1, Math.min(200, Number(params.page) || 1));
  const supabase = await supabaseForUser();

  let query = supabase
    .from("pricing_suggestions")
    .select(SUGGESTION_COLUMNS.replace("products(", "products!inner("), { count: "exact" });
  for (const [k, v] of Object.entries(view.filter)) query = query.eq(k, v);
  if (q) query = query.ilike("products.name", `%${q.replace(/[%_]/g, "")}%`);
  const order = view.key === "sans-donnees" ? "current_cents" : "margin_pct";

  const [{ data, count }, { data: competitors }, ...counts] = await Promise.all([
    query.order(order, { ascending: view.key !== "sans-donnees" }).range((page - 1) * PAGE, page * PAGE - 1).returns<Suggestion[]>(),
    supabase.from("competitors").select("id, name").returns<Pick<Competitor, "id" | "name">[]>(),
    ...VIEWS.map((v) => {
      let c = supabase.from("pricing_suggestions").select("product_id", { count: "exact", head: true });
      for (const [k, val] of Object.entries(v.filter)) c = c.eq(k, val);
      return c;
    }),
  ]);
  const names = new Map((competitors ?? []).map((c) => [c.id, c.name]));
  const rows = data ?? [];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const link = (p: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ vue: view.key, q: q || undefined, ...p })) if (v !== undefined && v !== "") sp.set(k, String(v));
    return `/admin/pricing?${sp}`;
  };

  return (
    <>
      <div className="page-head">
        <h1>Pricing et positionnement</h1>
        <p className="lede">
          Prix conseillé : 3 à 6 % sous le prix moyen du marché, jamais sous le plancher (coût complet + marge minimale). Les
          écarts de 5 % ou moins sont appliqués automatiquement ; les autres attendent votre validation.
        </p>
      </div>

      <nav className="sub-chips" aria-label="Vues">
        {VIEWS.map((v, i) => (
          <Link key={v.key} href={`/admin/pricing?vue=${v.key}`} className={`chip ${v.key === view.key ? "is-on" : ""}`}>
            {v.label} ({counts[i]?.count ?? 0})
          </Link>
        ))}
      </nav>

      <form method="get" action="/admin/pricing" className="pricing-search" role="search">
        <input type="hidden" name="vue" value={view.key} />
        <label htmlFor="pq" className="visually-hidden">
          Rechercher un produit
        </label>
        <input id="pq" name="q" defaultValue={q} placeholder="Rechercher un produit…" maxLength={80} />
        <button className="btn btn-dark btn-sm">Rechercher</button>
      </form>

      <form id="bulk" action={decidePrices} className="account-card section-gap">
        {view.key === "a-valider" && rows.length > 0 && (
          <div className="bulk-bar">
            <span>Sélection :</span>
            <button name="decision" value="accept" className="btn btn-primary btn-sm">
              Appliquer les prix conseillés
            </button>
            <button name="decision" value="refuse" className="btn btn-quiet btn-sm">
              Refuser
            </button>
          </div>
        )}
        {rows.length === 0 ? (
          <p className="field-hint">
            {view.key === "a-valider"
              ? "Aucun prix à valider. Ajoutez des prix concurrents (onglet Concurrents) pour que le moteur fasse des propositions."
              : "Aucun produit dans cette vue."}
          </p>
        ) : (
          <div className="table-scroll">
            <table className="data-table pricing-table">
              <thead>
                <tr>
                  {view.key === "a-valider" && (
                    <th>
                      <SelectAll form="bulk" />
                    </th>
                  )}
                  <th>Produit</th>
                  <th>Coût réel</th>
                  <th>Prix actuel</th>
                  <th>Moyenne marché</th>
                  <th>Le moins cher</th>
                  <th>Marge</th>
                  <th>Conseillé</th>
                  <th>Rang</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const st = PRICING_STATUS[s.status];
                  const delta = s.suggested_cents - s.current_cents;
                  return (
                    <tr key={s.product_id}>
                      {view.key === "a-valider" && (
                        <td>
                          <input type="checkbox" name="id" value={s.product_id} aria-label={`Sélectionner ${s.products?.name}`} />
                        </td>
                      )}
                      <td className="cell-clip">
                        <Link href={`/admin/pricing/${s.product_id}`}>{s.products ? `${s.products.brand} ${s.products.name}` : s.product_id}</Link>
                        <div className="field-hint">
                          {s.products?.category_slug} {s.products && !s.products.in_stock && "· rupture"}
                        </div>
                      </td>
                      <td>{euros(s.cost_real_cents)}</td>
                      <td>{euros(s.current_cents)}</td>
                      <td>{euros(s.market_avg_cents)}</td>
                      <td>
                        {euros(s.market_min_cents)}
                        {s.cheapest_competitor_id && <div className="field-hint">{names.get(s.cheapest_competitor_id)}</div>}
                      </td>
                      <td className={s.margin_pct < 5 ? "num-warn" : undefined}>
                        {euros(s.margin_cents)}
                        <div className="field-hint">{pct(s.margin_pct)}</div>
                      </td>
                      <td>
                        <strong>{euros(s.suggested_cents)}</strong>
                        {delta !== 0 && (
                          <div className={delta < 0 ? "num-down" : "num-up"}>
                            {delta > 0 ? "+" : ""}
                            {pct((100 * delta) / s.current_cents)}
                          </div>
                        )}
                      </td>
                      <td>{s.rank ? `${s.rank}/${s.market_count + 1}` : "—"}</td>
                      <td>
                        <span title={st.label}>
                          {st.icon} {st.label}
                        </span>
                        <div className="field-hint">{DECISIONS[s.decision]}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </form>

      {pages > 1 && (
        <nav className="pagination" aria-label="Pages">
          {page > 1 ? (
            <Link className="btn btn-quiet btn-sm" href={link({ page: page - 1 })}>
              Page précédente
            </Link>
          ) : (
            <span />
          )}
          <span className="field-hint">
            Page {page} sur {pages}
          </span>
          {page < pages && (
            <Link className="btn btn-quiet btn-sm" href={link({ page: page + 1 })}>
              Page suivante
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
