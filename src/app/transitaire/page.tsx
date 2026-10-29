import type { Metadata } from "next";
import Link from "next/link";
import { requireForwarder } from "@/lib/staff";
import { supabaseForUser } from "@/lib/supabase-server";
import { STATUSES, SHIPMENT_COLUMNS, dateOnly, type Shipment } from "@/lib/transit";
import { signOut } from "../compte/actions";

export const metadata: Metadata = { title: "Espace transitaire", robots: { index: false, follow: false } };

export default async function ForwarderHome() {
  const staff = await requireForwarder();
  const supabase = await supabaseForUser();
  const [{ data: company }, { data: shipments }] = await Promise.all([
    supabase.from("forwarders").select("name, warehouse_address").eq("id", staff.forwarderId!).maybeSingle<{ name: string; warehouse_address: string | null }>(),
    supabase.from("shipments").select(SHIPMENT_COLUMNS).order("created_at", { ascending: false }).limit(300).returns<Shipment[]>(),
  ]);
  const list = shipments ?? [];
  const sections: { title: string; items: Shipment[]; empty: string }[] = [
    { title: "À réceptionner", items: list.filter((s) => s.status === "attendu"), empty: "Aucun colis attendu." },
    {
      title: "En cours d'acheminement",
      items: list.filter((s) => !["attendu", "livre"].includes(s.status)),
      empty: "Aucune expédition en cours.",
    },
    { title: "Livrées", items: list.filter((s) => s.status === "livre").slice(0, 30), empty: "Aucune pour l'instant." },
  ];

  return (
    <div className="wrap admin">
      <div className="page-head">
        <h1>Espace transitaire</h1>
        <p className="lede">
          {company?.name ?? "Votre société"} · {staff.email}
        </p>
      </div>
      {sections.map((sec) => (
        <section key={sec.title} className="account-card section-gap">
          <h2>
            {sec.title} ({sec.items.length})
          </h2>
          {sec.items.length === 0 ? (
            <p className="field-hint">{sec.empty}</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Expédition</th>
                  <th>Contenu</th>
                  <th>Destinataire</th>
                  <th>Étape</th>
                  <th>Annoncée le</th>
                </tr>
              </thead>
              <tbody>
                {sec.items.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/transitaire/${s.id}`}>{s.number}</Link>
                      {s.expected_parcels && <div className="field-hint">{s.expected_parcels} colis attendus</div>}
                    </td>
                    <td className="cell-clip">{s.contents}</td>
                    <td>{[s.customer_name, s.customer_city].filter(Boolean).join(", ") || "—"}</td>
                    <td>{STATUSES[s.status]}</td>
                    <td>{dateOnly.format(new Date(s.created_at))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
      <form action={signOut}>
        <button className="btn btn-quiet btn-sm">Se déconnecter</button>
      </form>
    </div>
  );
}
