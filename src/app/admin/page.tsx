import Link from "next/link";
import { NewShipmentForm } from "@/components/transit/TransitForms";
import { getDeliveryZones } from "@/lib/catalog";
import { supabaseForUser } from "@/lib/supabase-server";
import { STATUSES, SHIPMENT_COLUMNS, dateOnly, missingExportProof, type Shipment, type ShipmentStatus } from "@/lib/transit";

const GROUPS: { key: string; label: string; statuses: ShipmentStatus[] }[] = [
  { key: "entrepot", label: "Vers l'entrepôt", statuses: ["attendu"] },
  { key: "france", label: "En France", statuses: ["recu", "en_preparation"] },
  { key: "route", label: "En route", statuses: ["expedie", "arrive_cameroun", "dedouane", "remis_livreur"] },
  { key: "incident", label: "Incidents", statuses: ["incident"] },
  { key: "livre", label: "Livrés", statuses: ["livre"] },
];

export default async function AdminShipments({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { vue } = await searchParams;
  const supabase = await supabaseForUser();
  const [{ data: shipments }, { data: forwarders }, { data: proofs }, zones] = await Promise.all([
    supabase.from("shipments").select(SHIPMENT_COLUMNS).order("created_at", { ascending: false }).limit(300).returns<Shipment[]>(),
    supabase.from("forwarders").select("id, name").eq("active", true).order("name").returns<{ id: string; name: string }[]>(),
    supabase.from("shipment_documents").select("shipment_id").eq("kind", "preuve_export").returns<{ shipment_id: string }[]>(),
    getDeliveryZones(),
  ]);
  const list = shipments ?? [];
  const names = new Map((forwarders ?? []).map((f) => [f.id, f.name]));
  const withProof = new Set((proofs ?? []).map((p) => p.shipment_id));
  const group = GROUPS.find((g) => g.key === vue);
  const shown = group ? list.filter((s) => group.statuses.includes(s.status)) : list.filter((s) => s.status !== "livre");
  const unread = (s: Shipment) => s.forwarder_activity_at && (!s.admin_seen_at || s.forwarder_activity_at > s.admin_seen_at);
  const noProof = (s: Shipment) => missingExportProof(s, withProof.has(s.id) ? [{ kind: "preuve_export" }] : []);

  return (
    <>
      <div className="page-head">
        <h1>Expéditions vers le Cameroun</h1>
        <p className="lede">
          {list.filter(unread).length} mise(s) à jour du transitaire non lue(s) · {list.filter(noProof).length} preuve(s)
          d&apos;export manquante(s)
        </p>
      </div>
      <nav className="sub-chips" aria-label="Filtrer">
        <Link href="/admin" className={`chip ${!group ? "is-on" : ""}`}>
          En cours
        </Link>
        {GROUPS.map((g) => (
          <Link key={g.key} href={`/admin?vue=${g.key}`} className={`chip ${group?.key === g.key ? "is-on" : ""}`}>
            {g.label} ({list.filter((s) => g.statuses.includes(s.status)).length})
          </Link>
        ))}
      </nav>
      <div className="transit-grid">
        <div className="transit-main">
          <div className="account-card">
            {shown.length === 0 ? (
              <p className="field-hint">Aucune expédition dans cette vue.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Expédition</th>
                    <th>Contenu</th>
                    <th>Transitaire</th>
                    <th>Étape</th>
                    <th>Créée le</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/admin/expeditions/${s.id}`}>{s.number}</Link>
                        {unread(s) && <span className="pill pill-new">Nouveau</span>}
                        {noProof(s) && <span className="pill pill-warn">Preuve d&apos;export</span>}
                        {s.order_number && <div className="field-hint">{s.order_number}</div>}
                      </td>
                      <td className="cell-clip">{s.contents}</td>
                      <td>{names.get(s.forwarder_id) ?? "—"}</td>
                      <td>{STATUSES[s.status]}</td>
                      <td>{dateOnly.format(new Date(s.created_at))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <aside className="transit-side">
          <section className="account-card">
            <h2>Nouvelle expédition</h2>
            <NewShipmentForm forwarders={forwarders ?? []} cities={zones.map((z) => z.city)} />
          </section>
        </aside>
      </div>
    </>
  );
}
