import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getDeliveryZones } from "@/lib/catalog";
import { getMarket } from "@/lib/market-server";
import { currentUser } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Créer un compte", robots: { index: false } };

export default async function SignupPage() {
  if (await currentUser()) redirect("/compte");
  const [zones, market] = await Promise.all([getDeliveryZones(), getMarket()]);
  return (
    <div className="wrap">
      <div className="auth">
        <h1>Créer un compte</h1>
        <p className="lede">
          Votre adresse est enregistrée une fois pour toutes, et vous suivez vos commandes. Vous pouvez aussi commander
          sans compte.
        </p>
        <AuthForm mode="signup" zones={zones.map((z) => ({ slug: z.slug, city: z.city }))} defaultCountry={market} />
        <p className="auth-switch">
          Déjà client ? <Link href="/connexion">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
