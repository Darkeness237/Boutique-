import type { Metadata } from "next";
import Link from "next/link";
import { Configurator } from "@/components/configurator/Configurator";

export const metadata: Metadata = {
  title: "Configurateur PC 3D",
  description:
    "Composez votre PC et votre setup étape par étape, en 3D : seules les pièces compatibles et en stock sont proposées.",
  alternates: { canonical: "/configurateur" },
};

export default function ConfigurateurPage() {
  return (
    <div className="wrap configurator-page">
      <div className="page-head">
        <h1>Configurateur PC en 3D</h1>
        <p className="lede">
          Choisissez vos pièces une à une et regardez votre PC se monter, puis complétez le setup : écran, clavier, souris,
          casque et fauteuil. Seules les pièces compatibles et en stock sont proposées. Vous préférez aller vite ?{" "}
          <Link href="/configs">Voir les configs prêtes à commander</Link>.
        </p>
      </div>
      <Configurator />
      <p className="field-hint section-gap">
        Vue 3D indicative, dessinée d&apos;après les caractéristiques des pièces. Montage non inclus : les pièces sont livrées
        séparément.
      </p>
    </div>
  );
}
