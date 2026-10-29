import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getStaff } from "@/lib/staff";

export const metadata: Metadata = { title: "Connexion transitaire", robots: { index: false } };

export default async function ForwarderLogin() {
  const staff = await getStaff();
  if (staff) redirect(staff.role === "admin" ? "/admin" : "/transitaire");
  return (
    <div className="wrap">
      <div className="auth">
        <h1>Espace transitaire</h1>
        <p className="lede">Connectez-vous avec l&apos;adresse e-mail que Vetex PC a invitée.</p>
        <AuthForm mode="login" />
        <p className="auth-switch">
          Première connexion ? <Link href="/transitaire/inscription">Créer votre accès</Link>
        </p>
      </div>
    </div>
  );
}
