import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/staff";
import { supabaseForUser } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Administration", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const supabase = await supabaseForUser();
  const [{ count: alerts }, { count: pending }, { data: toHandle }] = await Promise.all([
    supabase.from("pricing_alerts").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase.from("pricing_suggestions").select("product_id", { count: "exact", head: true }).eq("decision", "a_valider"),
    supabase.rpc("admin_orders_to_handle"),
  ]);
  return (
    <div className="wrap admin">
      <nav className="admin-nav" aria-label="Administration">
        <strong>Administration</strong>
        <Link href="/admin/commandes">Commandes{toHandle ? <span className="nav-count">{toHandle as number}</span> : null}</Link>
        <Link href="/admin">Expéditions Cameroun</Link>
        <Link href="/admin/transitaires">Transitaires</Link>
        <Link href="/admin/pricing">Pricing{pending ? <span className="nav-count">{pending}</span> : null}</Link>
        <Link href="/admin/alertes">Alertes{alerts ? <span className="nav-count">{alerts}</span> : null}</Link>
        <Link href="/admin/concurrents">Concurrents et réglages</Link>
      </nav>
      {children}
    </div>
  );
}
