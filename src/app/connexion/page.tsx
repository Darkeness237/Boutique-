import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { currentUser } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Se connecter", robots: { index: false } };

const ERRORS: Record<string, string> = {
  google: "La connexion avec Google n'a pas abouti. Réessayez, ou utilisez votre e-mail.",
  lien: "Ce lien a expiré ou a déjà servi. Connectez-vous, ou demandez un nouveau lien en vous réinscrivant.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  if (await currentUser()) redirect("/compte");
  const { erreur } = await searchParams;
  return (
    <div className="wrap">
      <div className="auth">
        <h1>Se connecter</h1>
        <p className="lede">Retrouvez vos commandes et votre adresse de livraison.</p>
        {erreur && ERRORS[erreur] && (
          <p className="form-notice" role="alert">
            {ERRORS[erreur]}
          </p>
        )}
        <AuthForm mode="login" />
        <p className="auth-switch">
          Pas encore de compte ? <Link href="/inscription">Créer un compte</Link>
        </p>
      </div>
    </div>
  );
}
