import Link from "next/link";
import { ORDER_STATUS, isOrderStatus, money, type AdminOrderRow } from "@/lib/admin-orders";
import { supabaseForUser } from "@/lib/supabase-server";
import { dateTime } from "@/lib/transit";

export const dynamic = "force-dynamic";

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const { statut } = await searchParams;
  const filter = statut && isOrderStatus(statut) ? statut : null;
  const supabase = await supabaseForUser();
  const [{ data: rows, error }, { data: allRows }] = await Promise.all([
    supabase.rpc("admin_orders", { p_status: filter }),
    supabase.rpc("admin_orders", { p_status: null }),
  ]);
  if (error) console.error("Commandes (liste) :", error.message);
  const list = (rows ?? []) as AdminOrderRow[];
  const all = (allRows ?? []) as AdminOrderRow[];
  const counts = new Map<string, number>();
  for (const o of all) counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
  const toHandle = counts.get("payee") ?? 0;
  const revenue = all.filter((o) => o.currency === "eur" && !["annulee", "remboursee"].includes(o.status));

  return (
    <>
      <div className="page-head">
        <h1>Commandes</h1>
        <p className="lede">
          {toHandle > 0 ? (
            <strong>{toHandle} commande(s) payée(s) à passer chez le fournisseur.</strong>
          ) : (
            "Aucune commande en attente."
          )}{" "}
          {revenue.length} commande(s) en euros pour {money(revenue.reduce((s, o) => s + o.total, 0), "eur")} encaissés.
        </p>
      </div>

      <nav className="filter-tabs" aria-label="Filtrer par statut">
        <Link href="/admin/commandes" aria-current={!filter ? "page" : undefined}>
          Toutes <span className="nav-count">{all.length}</span>
        </Link>
        {Object.entries(ORDER_STATUS).map(([key, s]) => (
          <Link key={key} href={`/admin/commandes?statut=${key}`} aria-current={filter === key ? "page" : undefined}>
            {s.label} {counts.get(key) ? <span className="nav-count">{counts.get(key)}</span> : null}
          </Link>
        ))}
      </nav>

      {list.length === 0 ? (
        <p className="field-hint">Aucune commande{filter ? " avec ce statut" : ""}.</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Date</th>
                <th>Client</th>
                <th>Articles</th>
                <th>Total</th>
                <th>Marge brute</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => {
                const margin = o.currency === "eur" && o.cost > 0 ? o.total - o.cost : null;
                return (
                  <tr key={o.id} className={o.seen ? undefined : "row-new"}>
                    <td>
                      <Link href={`/admin/commandes/${o.id}`}>
                        <strong>{o.number}</strong>
                      </Link>
                      {!o.seen && <span className="badge badge-new">nouvelle</span>}
                    </td>
                    <td className="field-hint">{dateTime.format(new Date(o.created_at))}</td>
                    <td>
                      {o.customer_name ?? "—"}
                      <br />
                      <span className="field-hint">{o.email}</span>
                    </td>
                    <td>{o.items}</td>
                    <td>{money(o.total, o.currency)}</td>
                    <td>{margin === null ? "—" : money(margin, "eur")}</td>
                    <td>
                      <span className={`status-pill tone-${ORDER_STATUS[o.status]?.tone ?? "muted"}`}>
                        {ORDER_STATUS[o.status]?.label ?? o.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="field-hint section-gap">
        La marge brute est le total payé moins le coût fournisseur des articles (hors frais Stripe et de livraison).
      </p>
    </>
  );
}
