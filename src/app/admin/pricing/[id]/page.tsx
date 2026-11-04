import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/pricing/ActionForm";
import { saveCompetitorUrl, saveOverride } from "@/lib/pricing-actions";
import { DECISIONS, PRICING_STATUS, SUGGESTION_COLUMNS, euros, pct, type Competitor, type Suggestion } from "@/lib/pricing";
import { supabaseForUser } from "@/lib/supabase-server";
import { dateOnly, dateTime } from "@/lib/transit";

type Point = { t: number; v: number };

/** Courbes en SVG : prix de vente, coût TTC fournisseur et prix concurrents (points). */
function HistoryChart({ series }: { series: { label: string; color: string; points: Point[]; dots?: boolean }[] }) {
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) return <p className="field-hint">Pas encore assez d&apos;historique pour tracer une courbe.</p>;
  const W = 640, H = 220, P = 36;
  const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t), t0 + 1);
  const v0 = Math.min(...all.map((p) => p.v)) * 0.97, v1 = Math.max(...all.map((p) => p.v)) * 1.03;
  const x = (t: number) => P + ((t - t0) / (t1 - t0)) * (W - P * 2);
  const y = (v: number) => H - P - ((v - v0) / (v1 - v0)) * (H - P * 2);
  const step = (pts: Point[]) =>
    pts
      .map((p, i) => (i === 0 ? `M${x(p.t)},${y(p.v)}` : `H${x(p.t)}V${y(p.v)}`))
      .join("") + (pts.length ? `H${x(t1)}` : "");
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Historique des prix">
        {[v0, (v0 + v1) / 2, v1].map((v) => (
          <g key={v}>
            <line x1={P} x2={W - P} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity=".12" />
            <text x={4} y={y(v) + 4} fontSize="10" fill="currentColor" opacity=".6">
              {Math.round(v / 100)} €
            </text>
          </g>
        ))}
        {series.map((s) =>
          s.dots ? (
            s.points.map((p, i) => <circle key={`${s.label}${i}`} cx={x(p.t)} cy={y(p.v)} r={3} fill={s.color} opacity=".7" />)
          ) : (
            <path key={s.label} d={step(s.points)} fill="none" stroke={s.color} strokeWidth={2} />
          ),
        )}
      </svg>
      <figcaption className="chart-legend">
        {series.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} /> {s.label}
          </span>
        ))}
        <span className="field-hint">
          {dateOnly.format(new Date(t0))} → {dateOnly.format(new Date(t1))}
        </span>
      </figcaption>
    </figure>
  );
}

export default async function PricingProduct({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const supabase = await supabaseForUser();
  const since = new Date(Date.now() - 180 * 86_400_000).toISOString();

  const [{ data: base }, { data: costs0 }, { data: s }, { data: ov }, { data: competitors }, { data: urls }, { data: prices }, { data: sales }, { data: costs }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, brand, slug, category_slug, ean, in_stock, price_cents, promo_price_cents, promo_label")
        .eq("id", id)
        .maybeSingle(),
      supabase.rpc("admin_product_costs", { p_id: id }).maybeSingle<{
        default_price_cents: number | null;
        engine_price_cents: number | null;
        cost_ttc_cents: number | null;
        pricing_floor_cents: number | null;
        floor_cents: number | null;
      }>(),
      supabase.from("pricing_suggestions").select(SUGGESTION_COLUMNS).eq("product_id", id).maybeSingle<Suggestion>(),
      supabase.from("product_overrides").select("*").eq("product_id", id).maybeSingle(),
      supabase.from("competitors").select("id, name, domain, collect, active").order("name").returns<Competitor[]>(),
      supabase.from("competitor_urls").select("competitor_id, url, last_status, last_checked_at").eq("product_id", id),
      supabase
        .from("competitor_prices")
        .select("competitor_id, price_cents, source, observed_at")
        .eq("product_id", id)
        .gte("observed_at", since)
        .order("observed_at")
        .returns<{ competitor_id: number; price_cents: number; source: string; observed_at: string }[]>(),
      supabase.from("price_history").select("price_cents, recorded_at").eq("product_id", id).gte("recorded_at", since).order("recorded_at"),
      supabase.from("margin_history").select("cost_ttc_cents, recorded_at").eq("product_id", id).gte("recorded_at", since).order("recorded_at"),
    ]);
  if (!base) notFound();
  const product = { ...base, ...(costs0 ?? {}) };

  const latest = new Map<number, { price_cents: number; source: string; observed_at: string }>();
  for (const p of prices ?? []) latest.set(p.competitor_id, p);
  const urlBy = new Map((urls ?? []).map((u) => [u.competitor_id, u]));
  const st = s ? PRICING_STATUS[s.status] : null;

  return (
    <>
      <div className="page-head">
        <ol className="breadcrumb" aria-label="Fil d'Ariane">
          <li>
            <Link href="/admin/pricing">Pricing</Link>
          </li>
          <li aria-current="page">{product.brand}</li>
        </ol>
        <h1>
          {product.brand} {product.name}
        </h1>
        <p className="lede">
          EAN {product.ean} · {product.category_slug} · {product.in_stock ? "en stock chez 1foTrade" : "rupture chez 1foTrade"} ·{" "}
          <Link href={`/produit/${product.slug}`} target="_blank">
            voir la fiche
          </Link>
        </p>
      </div>

      <div className="transit-grid">
        <div className="transit-main">
          <section className="account-card">
            <h2>
              {st?.icon} {st?.label ?? "Pas encore calculé"}
            </h2>
            <dl className="facts">
              <div><dt>Prix en vitrine</dt><dd>{euros(product.price_cents)}{product.promo_price_cents ? ` · promo ${euros(product.promo_price_cents)} (${product.promo_label})` : ""}</dd></div>
              <div><dt>Coût fournisseur TTC</dt><dd>{euros(product.cost_ttc_cents)}</dd></div>
              <div><dt>Coût réel (avec frais)</dt><dd>{euros(s?.cost_real_cents)}</dd></div>
              <div><dt>Marge actuelle</dt><dd>{euros(s?.margin_cents)} · {pct(s?.margin_pct)}</dd></div>
              <div><dt>Plancher du moteur</dt><dd>{euros(product.pricing_floor_cents)} (plancher absolu {euros(product.floor_cents)})</dd></div>
              <div><dt>Prix par défaut (marge cible)</dt><dd>{euros(product.default_price_cents)}</dd></div>
              <div><dt>Marché (7 jours)</dt><dd>{s?.market_count ? `${euros(s.market_min_cents)} · moy. ${euros(s.market_avg_cents)} · ${euros(s.market_max_cents)} (${s.market_count} concurrent(s))` : "aucun relevé"}</dd></div>
              <div><dt>Prix conseillé</dt><dd><strong>{euros(s?.suggested_cents)}</strong> · {s ? DECISIONS[s.decision] : "—"}</dd></div>
            </dl>
          </section>

          <section className="account-card">
            <h2>Historique (6 mois)</h2>
            <HistoryChart
              series={[
                { label: "Prix de vente", color: "#1f63b5", points: (sales ?? []).map((p) => ({ t: Date.parse(p.recorded_at), v: p.price_cents })) },
                { label: "Coût TTC 1foTrade", color: "#a95207", points: (costs ?? []).map((p) => ({ t: Date.parse(p.recorded_at), v: p.cost_ttc_cents })) },
                { label: "Concurrents", color: "#22a845", dots: true, points: (prices ?? []).map((p) => ({ t: Date.parse(p.observed_at), v: p.price_cents })) },
              ]}
            />
          </section>

          <section className="account-card">
            <h2>Concurrents</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Dernier prix</th>
                  <th>Relevé</th>
                  <th>Page suivie</th>
                </tr>
              </thead>
              <tbody>
                {(competitors ?? []).map((c) => {
                  const l = latest.get(c.id);
                  const u = urlBy.get(c.id);
                  return (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{l ? euros(l.price_cents) : "—"}</td>
                      <td className="field-hint">{l ? `${dateTime.format(new Date(l.observed_at))} · ${l.source}` : "—"}</td>
                      <td className="cell-clip">
                        {u ? (
                          <a href={u.url} target="_blank" rel="noopener noreferrer nofollow">
                            {u.last_status ?? "en attente"}
                          </a>
                        ) : c.collect ? (
                          "—"
                        ) : (
                          <span className="field-hint">relevé automatique interdit</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>

        <aside className="transit-side">
          <section className="account-card">
            <h2>Suivre ou saisir un prix concurrent</h2>
            <ActionForm action={saveCompetitorUrl} submit="Enregistrer">
              <input type="hidden" name="product_id" value={product.id} />
              <div className="field">
                <label htmlFor="competitor_id">Concurrent</label>
                <select id="competitor_id" name="competitor_id">
                  {(competitors ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="url">Adresse de la fiche produit (relevé chaque nuit)</label>
                <input id="url" name="url" type="url" placeholder="https://www.ldlc.com/fiche/…" maxLength={500} />
              </div>
              <div className="field">
                <label htmlFor="price">Ou prix constaté aujourd&apos;hui (€)</label>
                <input id="price" name="price" inputMode="decimal" placeholder="149,90" />
              </div>
            </ActionForm>
          </section>

          <section className="account-card">
            <h2>Réglages du produit</h2>
            <p className="field-hint">Ces réglages ne sont jamais écrasés par l&apos;import 1foTrade ni par le moteur.</p>
            <ActionForm action={saveOverride} submit="Enregistrer les réglages">
              <input type="hidden" name="product_id" value={product.id} />
              <div className="field">
                <label htmlFor="fixed_price">Prix imposé (€, vide = automatique)</label>
                <input id="fixed_price" name="fixed_price" inputMode="decimal" defaultValue={ov?.fixed_price_cents ? (ov.fixed_price_cents / 100).toFixed(2).replace(".", ",") : ""} />
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="min_margin_pct">Marge mini (%)</label>
                  <input id="min_margin_pct" name="min_margin_pct" inputMode="decimal" defaultValue={ov?.min_margin_pct ?? ""} placeholder="catégorie" />
                </div>
                <div className="field">
                  <label htmlFor="min_margin">Marge mini (€)</label>
                  <input id="min_margin" name="min_margin" inputMode="decimal" defaultValue={ov?.min_margin_cents ? (ov.min_margin_cents / 100).toFixed(2).replace(".", ",") : ""} placeholder="catégorie" />
                </div>
              </div>
              <label className="consent">
                <input type="checkbox" name="exclude" defaultChecked={ov?.exclude_from_repricing ?? false} />
                <span>Ne jamais changer le prix automatiquement</span>
              </label>
              <label className="consent">
                <input type="checkbox" name="featured" defaultChecked={ov?.featured ?? false} />
                <span>Mettre en avant sur l&apos;accueil</span>
              </label>
              <div className="field">
                <label htmlFor="note">Note interne</label>
                <textarea id="note" name="note" rows={2} maxLength={500} defaultValue={ov?.note ?? ""} />
              </div>
            </ActionForm>
          </section>
        </aside>
      </div>
    </>
  );
}
