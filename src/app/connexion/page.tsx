import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Se connecter", robots: { index: false } };

export default function LoginPage() {
  return (
    <div className="wrap">
      <div className="auth">
        <h1>Se connecter</h1>
        <p className="lede">Retrouvez vos commandes, factures et adresses de livraison.</p>
        <AuthForm mode="login" />
        <p className="auth-switch">
          Pas encore de compte ? <Link href="/inscription">Créer un compte</Link>
        </p>
      </div>
    </div>
  );
}
