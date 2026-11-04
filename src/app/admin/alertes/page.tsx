import Link from "next/link";
import { markAlertsRead } from "@/lib/pricing-actions";
import { ALERT_KINDS } from "@/lib/pricing";
import { supabaseForUser } from "@/lib/supabase-server";
import { dateTime } from "@/lib/transit";

type Alert = {
  id: number;
  kind: keyof typeof ALERT_KINDS;
  product_id: number | null;
  message: string;
  created_at: string;
  read_at: string | null;
  products: { name: string; brand: string } | null;
};

export default async function Alerts({ searchParams }: { searchParams: Promise<{ toutes?: string }> }) {
  const all = (await searchParams).toutes === "1";
  const supabase = await supabaseForUser();
  let q = supabase.from("pricing_alerts").select("id, kind, product_id, message, created_at, read_at, products(name, brand)");
  if (!all) q = q.is("read_at", null);
  const { data } = await q.order("created_at", { ascending: false }).limit(300).returns<Alert[]>();
  const alerts = data ?? [];

  return (
    <>
      <div className="page-head">
        <h1>Alertes</h1>
        <p className="lede">Concurrent moins cher, promotions 1foTrade, marges trop faibles, ruptures.</p>
      </div>
      <nav className="sub-chips">
        <Link href="/admin/alertes" className={`chip ${!all ? "is-on" : ""}`}>Non lues</Link>
        <Link href="/admin/alertes?toutes=1" className={`chip ${all ? "is-on" : ""}`}>Toutes</Link>
      </nav>
      <form action={markAlertsRead} className="account-card section-gap">
        {alerts.some((a) => !a.read_at) && (
          <div className="bulk-bar">
            <button className="btn btn-dark btn-sm">Tout marquer comme lu</button>
          </div>
        )}
        {alerts.length === 0 ? (
          <p className="field-hint">Aucune alerte.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Produit</th>
                <th>Détail</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} className={a.read_at ? "is-read" : undefined}>
                  <td>
                    <span className={`pill ${a.kind.includes("promo") ? "pill-new" : "pill-warn"}`}>{ALERT_KINDS[a.kind]}</span>
                  </td>
                  <td className="cell-clip">
                    {a.product_id ? <Link href={`/admin/pricing/${a.product_id}`}>{a.products ? `${a.products.brand} ${a.products.name}` : a.product_id}</Link> : "—"}
                  </td>
                  <td>{a.message}</td>
                  <td className="field-hint">{dateTime.format(new Date(a.created_at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </form>
    </>
  );
}
