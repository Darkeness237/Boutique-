import Link from "next/link";
import { notFound } from "next/navigation";
import { ShipmentView } from "@/components/transit/ShipmentView";
import { supabaseForUser } from "@/lib/supabase-server";
import { markSeen } from "@/lib/transit-actions";
import { SHIPMENT_COLUMNS, STATUSES, type Shipment } from "@/lib/transit";

export default async function AdminShipment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await supabaseForUser();
  const { data: s } = await supabase.from("shipments").select(SHIPMENT_COLUMNS).eq("id", id).maybeSingle<Shipment>();
  if (!s) notFound();
  const { data: f } = await supabase.from("forwarders").select("name").eq("id", s.forwarder_id).maybeSingle<{ name: string }>();
  await markSeen(id);
  return (
    <>
      <div className="page-head">
        <ol className="breadcrumb" aria-label="Fil d'Ariane">
          <li><Link href="/admin">Expéditions</Link></li>
          <li aria-current="page">{s.number}</li>
        </ol>
        <h1>{s.number}</h1>
        <p className="lede">{STATUSES[s.status]} · {f?.name ?? "Transitaire"}</p>
      </div>
      <ShipmentView shipment={s} viewer="admin" />
    </>
  );
}
