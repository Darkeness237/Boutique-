import { ActionForm } from "@/components/pricing/ActionForm";
import { importCompetitorCsv, saveSettings, toggleCompetitor } from "@/lib/pricing-actions";
import type { Competitor } from "@/lib/pricing";
import { supabaseForUser } from "@/lib/supabase-server";
import { dateTime } from "@/lib/transit";

type Settings = {
  stripe_pct: number;
  stripe_fixed_cents: number;
  packaging_cents: number;
  dropship_fee_cents: number;
  aftersale_pct: number;
  target_below_min_pct: number;
  target_below_max_pct: number;
  auto_apply_max_pct: number;
  supplier_promo_drop_pct: number;
};
const e = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export default async function Competitors() {
  const supabase = await supabaseForUser();
  const week = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ data: competitors }, { data: urls }, { data: recent }, { data: settings }] = await Promise.all([
    supabase.from("competitors").select("*").order("name").returns<Competitor[]>(),
    supabase.from("competitor_urls").select("competitor_id").returns<{ competitor_id: number }[]>(),
    supabase.from("competitor_prices").select("competitor_id").gte("observed_at", week).limit(20000).returns<{ competitor_id: number }[]>(),
    supabase.rpc("admin_pricing_settings").maybeSingle<Settings>(),
  ]);
  const count = (list: { competitor_id: number }[] | null, id: number) => (list ?? []).filter((r) => r.competitor_id === id).length;

  return (
    <>
      <div className="page-head">
        <h1>Concurrents et réglages</h1>
        <p className="lede">
          Le relevé automatique respecte les règles de chaque site (robots.txt) et ne contourne aucune protection. Amazon interdit
          la collecte automatisée dans ses conditions d&apos;utilisation : ses prix se complètent par import CSV ou saisie manuelle.
        </p>
      </div>
      <div className="transit-grid">
        <div className="transit-main">
          <section className="account-card">
            <h2>Sites suivis</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Relevé auto</th>
                  <th>Pages suivies</th>
                  <th>Prix (7 j)</th>
                  <th>Dernier passage</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(competitors ?? []).map((c) => (
                  <tr key={c.id} className={c.active ? undefined : "is-read"}>
                    <td>
                      {c.name}
                      <div className="field-hint">{c.domain}</div>
                    </td>
                    <td>{c.collect ? "oui" : "interdit (CSV)"}</td>
                    <td>{count(urls, c.id)}</td>
                    <td>{count(recent, c.id)}</td>
                    <td className="field-hint">
                      {c.last_checked_at ? `${dateTime.format(new Date(c.last_checked_at))} · ${c.last_status ?? ""}` : "jamais"}
                    </td>
                    <td>
                      <form action={toggleCompetitor}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="active" value={c.active ? "0" : "1"} />
                        <button className="link-btn">{c.active ? "Désactiver" : "Activer"}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="account-card">
            <h2>Importer des prix (CSV)</h2>
            <p className="field-hint">
              Une ligne par prix : <code>ean;concurrent;prix;url</code> (l&apos;URL est facultative ; si elle est fournie, le prix sera
              ensuite relevé automatiquement). Exemple : <code>4711081234567;LDLC;549,95;https://www.ldlc.com/fiche/PB00123456.html</code>
            </p>
            <ActionForm action={importCompetitorCsv} submit="Importer">
              <div className="field">
                <label htmlFor="file">Fichier CSV (800 Ko max.)</label>
                <input id="file" name="file" type="file" accept=".csv,text/csv,text/plain" required />
              </div>
            </ActionForm>
          </section>
        </div>

        <aside className="transit-side">
          <section className="account-card">
            <h2>Réglages du moteur</h2>
            {settings ? (
              <ActionForm action={saveSettings} submit="Enregistrer et recalculer">
                <p className="field-hint">Coût réel = coût 1foTrade TTC + frais ci-dessous.</p>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="stripe_pct">Frais carte (%)</label>
                    <input id="stripe_pct" name="stripe_pct" inputMode="decimal" defaultValue={settings.stripe_pct} />
                  </div>
                  <div className="field">
                    <label htmlFor="stripe_fixed">+ fixe (€)</label>
                    <input id="stripe_fixed" name="stripe_fixed" inputMode="decimal" defaultValue={e(settings.stripe_fixed_cents)} />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="packaging">Emballage (€)</label>
                    <input id="packaging" name="packaging" inputMode="decimal" defaultValue={e(settings.packaging_cents)} />
                  </div>
                  <div className="field">
                    <label htmlFor="dropship_fee">Frais d&apos;envoi 1foTrade (€)</label>
                    <input id="dropship_fee" name="dropship_fee" inputMode="decimal" defaultValue={e(settings.dropship_fee_cents)} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="aftersale_pct">Provision SAV / retours (%)</label>
                  <input id="aftersale_pct" name="aftersale_pct" inputMode="decimal" defaultValue={settings.aftersale_pct} />
                </div>
                <p className="field-hint">Positionnement visé sous la moyenne du marché :</p>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="target_below_min_pct">De (%)</label>
                    <input id="target_below_min_pct" name="target_below_min_pct" inputMode="decimal" defaultValue={settings.target_below_min_pct} />
                  </div>
                  <div className="field">
                    <label htmlFor="target_below_max_pct">À (%)</label>
                    <input id="target_below_max_pct" name="target_below_max_pct" inputMode="decimal" defaultValue={settings.target_below_max_pct} />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="auto_apply_max_pct">Auto si écart ≤ (%)</label>
                    <input id="auto_apply_max_pct" name="auto_apply_max_pct" inputMode="decimal" defaultValue={settings.auto_apply_max_pct} />
                  </div>
                  <div className="field">
                    <label htmlFor="supplier_promo_drop_pct">Promo 1foTrade si baisse ≥ (%)</label>
                    <input id="supplier_promo_drop_pct" name="supplier_promo_drop_pct" inputMode="decimal" defaultValue={settings.supplier_promo_drop_pct} />
                  </div>
                </div>
              </ActionForm>
            ) : (
              <p className="field-hint">Réglages indisponibles.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
