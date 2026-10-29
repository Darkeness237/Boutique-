import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShipmentView } from "@/components/transit/ShipmentView";
import { requireForwarder } from "@/lib/staff";
import { supabaseForUser } from "@/lib/supabase-server";
import { SHIPMENT_COLUMNS, STATUSES, type Shipment } from "@/lib/transit";

export const metadata: Metadata = { title: "Expédition", robots: { index: false, follow: false } };

export default async function ForwarderShipment({ params }: { params: Promise<{ id: string }> }) {
  await requireForwarder();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await supabaseForUser();
  // La politique d'accès de la base ne renvoie que les expéditions de la société du transitaire.
  const { data: s } = await supabase.from("shipments").select(SHIPMENT_COLUMNS).eq("id", id).maybeSingle<Shipment>();
  if (!s) notFound();
  return (
    <div className="wrap admin">
      <div className="page-head">
        <ol className="breadcrumb" aria-label="Fil d'Ariane">
          <li><Link href="/transitaire">Mes expéditions</Link></li>
          <li aria-current="page">{s.number}</li>
        </ol>
        <h1>{s.number}</h1>
        <p className="lede">{STATUSES[s.status]}</p>
      </div>
      <ShipmentView shipment={s} viewer="forwarder" />
    </div>
  );
}
