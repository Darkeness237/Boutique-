import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/admin/CopyButton";
import { ActionForm } from "@/components/pricing/ActionForm";
import { ORDER_STATUS, addressLines, money, trackingUrl, type AdminOrder, type AdminOrderLine } from "@/lib/admin-orders";
import { updateOrder } from "@/lib/admin-orders-actions";
import { supabaseForUser } from "@/lib/supabase-server";
import { dateTime } from "@/lib/transit";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await supabaseForUser();
  const { data, error } = await supabase.rpc("admin_order", { p_id: id });
  if (error) console.error("Commande (détail) :", error.message);
  const o = data as AdminOrder | null;
  if (!o) notFound();

  const address = addressLines(o);
  const cost = o.lines.reduce((s, l) => s + (l.supplier_cost_cents ?? 0) * l.qty, 0);
  const missingCost = o.lines.some((l) => l.supplier_cost_cents == null);
  // Une ligne par fournisseur : c'est ce qu'il faut commander chez chacun.
  const bySupplier = new Map<string, AdminOrderLine[]>();
  for (const l of o.lines) {
    const key = l.supplier_name ?? "Fournisseur inconnu";
    bySupplier.set(key, [...(bySupplier.get(key) ?? []), l]);
  }
  const trackUrl = trackingUrl(o.carrier, o.tracking);
  const st = ORDER_STATUS[o.status];

  return (
    <>
      <div className="page-head">
        <ol className="breadcrumb" aria-label="Fil d'Ariane">
          <li>
            <Link href="/admin/commandes">Commandes</Link>
          </li>
          <li aria-current="page">{o.number}</li>
        </ol>
        <h1>
          Commande {o.number}{" "}
          <span className={`status-pill tone-${st?.tone ?? "muted"}`}>{st?.label ?? o.status}</span>
        </h1>
        <p className="lede">
          Payée le {dateTime.format(new Date(o.created_at))} · {money(o.total, o.currency)} ·{" "}
          {o.market === "cm" ? "Cameroun" : "France"}
          {o.status_changed_at ? ` · statut mis à jour le ${dateTime.format(new Date(o.status_changed_at))}` : ""}
        </p>
      </div>

      <div className="transit-grid">
        <div className="transit-main">
          {[...bySupplier.entries()].map(([supplier, lines]) => (
            <section className="account-card" key={supplier}>
              <h2>À commander chez {supplier}</h2>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th>Réf. fournisseur</th>
                      <th>EAN</th>
                      <th>Qté</th>
                      <th>Prix payé</th>
                      <th>Coût fournisseur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={`${l.product_id}-${i}`}>
                        <td>
                          {l.slug ? (
                            <Link href={`/produit/${l.slug}`} target="_blank">
                              {l.name}
                            </Link>
                          ) : (
                            l.name
                          )}
                        </td>
                        <td>
                          {l.supplier_sku ? (
                            <>
                              <code>{l.supplier_sku}</code> <CopyButton text={l.supplier_sku} label="Copier la référence" />
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="field-hint">{l.ean ?? "—"}</td>
                        <td>
                          <strong>{l.qty}</strong>
                        </td>
                        <td>{money(l.unit_price * l.qty, o.currency)}</td>
                        <td>{l.supplier_cost_cents == null ? "—" : money(l.supplier_cost_cents * l.qty, "eur")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          <section className="account-card">
            <h2>Montants</h2>
            <dl className="facts">
              <div>
                <dt>Articles</dt>
                <dd>{money(o.subtotal, o.currency)}</dd>
              </div>
              <div>
                <dt>Livraison facturée</dt>
                <dd>{money(o.shipping, o.currency)}</dd>
              </div>
              <div>
                <dt>Total payé</dt>
                <dd>
                  <strong>{money(o.total, o.currency)}</strong>
                </dd>
              </div>
              {o.currency === "eur" && (
                <div>
                  <dt>Coût fournisseur</dt>
                  <dd>
                    {money(cost, "eur")} · marge brute {money(o.total - cost, "eur")}
                    {missingCost ? " (coût incomplet)" : ""}
                  </dd>
                </div>
              )}
              {o.stripe_payment_intent && (
                <div>
                  <dt>Paiement Stripe</dt>
                  <dd>
                    <a href={`https://dashboard.stripe.com/payments/${o.stripe_payment_intent}`} target="_blank" rel="noopener noreferrer">
                      Voir dans Stripe
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </div>

        <aside className="transit-side">
          <section className="account-card">
            <h2>Livrer à</h2>
            <address className="ship-to">
              {address.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </address>
            <CopyButton text={address.join("\n")} label="Copier l'adresse" />
            <p className="field-hint">
              <a href={`mailto:${o.email}`}>{o.email}</a>
            </p>
          </section>

          <section className="account-card">
            <h2>Suivi</h2>
            {o.tracking && (
              <p>
                Colis : {trackUrl ? <a href={trackUrl} target="_blank" rel="noopener noreferrer">{o.tracking}</a> : o.tracking}
                {o.carrier ? ` (${o.carrier})` : ""}
              </p>
            )}
            <ActionForm action={updateOrder} submit="Enregistrer">
              <input type="hidden" name="id" value={o.id} />
              <div className="field">
                <label htmlFor="status">Statut</label>
                <select id="status" name="status" defaultValue={o.status}>
                  {Object.entries(ORDER_STATUS).map(([k, s]) => (
                    <option key={k} value={k}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="supplier_ref">N° de commande chez le fournisseur</label>
                <input id="supplier_ref" name="supplier_ref" maxLength={120} defaultValue={o.supplier_order_ref ?? ""} />
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="carrier">Transporteur</label>
                  <input id="carrier" name="carrier" list="carriers" maxLength={60} defaultValue={o.carrier ?? ""} />
                  <datalist id="carriers">
                    {["Colissimo", "Chronopost", "DPD", "GLS", "UPS", "DHL"].map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div className="field">
                  <label htmlFor="tracking">N° de suivi</label>
                  <input id="tracking" name="tracking" maxLength={80} defaultValue={o.tracking ?? ""} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="note">Note interne</label>
                <textarea id="note" name="note" rows={3} maxLength={2000} defaultValue={o.admin_note ?? ""} />
              </div>
            </ActionForm>
            <p className="field-hint">
              Le client voit le statut et le numéro de suivi sur la page « Suivre ma commande » et dans son compte.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
