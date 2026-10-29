import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/staff";

export const metadata: Metadata = { title: "Administration", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="wrap admin">
      <nav className="admin-nav" aria-label="Administration">
        <strong>Administration</strong>
        <Link href="/admin">Expéditions Cameroun</Link>
        <Link href="/admin/transitaires">Transitaires</Link>
      </nav>
      {children}
    </div>
  );
}
