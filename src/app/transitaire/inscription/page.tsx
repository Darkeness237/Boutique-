import type { Metadata } from "next";
import Link from "next/link";
import { PartnerSignupForm } from "@/components/PartnerSignupForm";

export const metadata: Metadata = { title: "Accès transitaire", robots: { index: false } };

export default function ForwarderSignup() {
  return (
    <div className="wrap">
      <div className="auth">
        <h1>Créer votre accès transitaire</h1>
        <p className="lede">
          Utilisez l&apos;adresse e-mail invitée par Vetex PC. Après confirmation de l&apos;adresse, vous verrez les expéditions de
          votre société.
        </p>
        <PartnerSignupForm />
        <p className="auth-switch">
          Déjà un accès ? <Link href="/transitaire/connexion">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
