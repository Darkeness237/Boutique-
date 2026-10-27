import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Créer un compte", robots: { index: false } };

export default function SignupPage() {
  return (
    <div className="wrap">
      <div className="auth">
        <h1>Créer un compte</h1>
        <p className="lede">Un compte sert à suivre vos commandes. Vous pouvez aussi commander sans.</p>
        <AuthForm mode="signup" />
        <p className="auth-switch">
          Déjà client ? <Link href="/connexion">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
