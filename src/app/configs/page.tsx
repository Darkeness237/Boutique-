import type { Metadata } from "next";
import Link from "next/link";
import { ConfigCard } from "@/components/ConfigCard";
import { getCategories } from "@/lib/catalog";
import { composeTiers } from "@/lib/configs";
import { getMarket } from "@/lib/market-server";

export const metadata: Metadata = {
  title: "Configs PC prêtes à commander",
  description: "PC complets compatibles, composés avec les pièces en stock : bureautique, gaming 1080p et gaming 1440p.",
};

export default async function ConfigsPage() {
  const [market, categories] = await Promise.all([getMarket(), getCategories()]);
  const builds = await composeTiers(market);
  return (
    <div className="wrap configs-page">
      <div className="page-head">
        <h1>Configs PC prêtes à commander</h1>
        <p className="lede">
          Processeur, carte mère, mémoire, stockage, refroidissement, alimentation et boîtier : tout est compatible et en stock
          aujourd&apos;hui. Ajoutez la config entière au panier en un clic, puis remplacez une pièce si vous le souhaitez.
        </p>
      </div>
      {builds.length === 0 ? (
        <p className="field-hint">
          Les configs sont en cours de mise à jour avec le stock. <Link href="/catalogue">Parcourir le catalogue</Link>
        </p>
      ) : (
        <div className="configs-grid">
          {builds.map((b) => (
            <ConfigCard key={b.tier.slug} build={b} categories={categories} market={market} />
          ))}
        </div>
      )}
      <p className="field-hint section-gap">
        Montage non inclus : les pièces sont livrées séparément. Une question sur une config ? <Link href="/aide">Écrivez-nous</Link>.
      </p>
    </div>
  );
}
