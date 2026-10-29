import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteAccountForm, ProfileForm } from "@/components/ProfileForm";
import { getDeliveryZones } from "@/lib/catalog";
import { formatMoney } from "@/lib/market";
import { getStaff } from "@/lib/staff";
import { currentUser, supabaseForUser } from "@/lib/supabase-server";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "Mon compte", robots: { index: false } };

const STATUS: Record<string, string> = {
  payee: "Payée",
  commandee_fournisseur: "En préparation",
  expediee: "Expédiée",
  livree: "Livrée",
  annulee: "Annulée",
  remboursee: "Remboursée",
};
const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });

type Profile = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  country: "fr" | "cm";
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  cm_zone: string | null;
  marketing_opt_in: boolean;
};
type Order = {
  number: string;
  status: string;
  market: "fr" | "cm";
  total: number;
  tracking: string | null;
  created_at: string;
  order_items: { name: string; qty: number }[];
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/connexion");

  const supabase = await supabaseForUser();
  const [{ data: profile }, { data: orders }, zones, params] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, phone, country, address_line1, address_line2, postal_code, city, cm_zone, marketing_opt_in")
      .eq("id", user.id)
      .maybeSingle<Profile>(),
    supabase
      .from("orders")
      .select("number, status, market, total, tracking, created_at, order_items(name, qty)")
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<Order[]>(),
    getDeliveryZones(),
    searchParams,
  ]);

  const staff = await getStaff();
  const incomplete = !profile?.phone || !profile.address_line1;
  const initial = {
    firstName: profile?.first_name ?? "",
    lastName: profile?.last_name ?? "",
    phone: profile?.phone ?? "",
    country: profile?.country ?? "fr",
    address1: profile?.address_line1 ?? "",
    address2: profile?.address_line2 ?? "",
    postalCode: profile?.postal_code ?? "",
    city: profile?.city ?? "",
    cmZone: profile?.cm_zone ?? "",
    newsletter: profile?.marketing_opt_in ?? false,
  };

  return (
    <div className="wrap account">
      <div className="page-head">
        <h1>Bonjour{profile?.first_name ? ` ${profile.first_name}` : ""}</h1>
        <p className="lede">{user.email}</p>
        {staff && (
          <p>
            <Link href={staff.role === "admin" ? "/admin" : "/transitaire"} className="btn btn-dark btn-sm">
              {staff.role === "admin" ? "Administration" : "Espace transitaire"}
            </Link>
          </p>
        )}
        {params.bienvenue && incomplete && (
          <p className="form-notice">
            Bienvenue ! Ajoutez votre adresse de livraison ci-dessous : elle sera prête pour votre première commande.
          </p>
        )}
      </div>

      <div className="account-grid">
        <section aria-labelledby="orders-title" className="account-card">
          <h2 id="orders-title">Mes commandes</h2>
          {orders && orders.length > 0 ? (
            <ul className="order-list">
              {orders.map((o) => (
                <li key={o.number}>
                  <p className="order-head">
                    <strong>{o.number}</strong>
                    <span className="order-status">{STATUS[o.status] ?? o.status}</span>
                  </p>
                  <p className="field-hint">
                    {date.format(new Date(o.created_at))} · {formatMoney(o.market, o.total)}
                  </p>
                  <p>{o.order_items.map((i) => `${i.qty} × ${i.name}`).join(", ")}</p>
                  {o.tracking && <p className="field-hint">Suivi : {o.tracking}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p>
              Aucune commande pour l&apos;instant. <Link href="/#config">Voir la config du moment</Link>
            </p>
          )}
        </section>

        <section aria-labelledby="delivery-title" className="account-card" id="livraison">
          <h2 id="delivery-title">Adresse de livraison</h2>
          <ProfileForm initial={initial} zones={zones.map((z) => ({ slug: z.slug, city: z.city }))} />
        </section>

        <section aria-labelledby="danger-title" className="account-card">
          <h2 id="danger-title">Session et données</h2>
          <form action={signOut}>
            <button type="submit" className="btn btn-dark">
              Se déconnecter
            </button>
          </form>
          <details className="account-delete">
            <summary>Supprimer mon compte</summary>
            <DeleteAccountForm />
          </details>
        </section>
      </div>
    </div>
  );
}
