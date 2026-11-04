import type { Metadata } from "next";
import { FavoritesView } from "./FavoritesView";

export const metadata: Metadata = { title: "Mes favoris", robots: { index: false } };

export default function FavoritesPage() {
  return (
    <>
      <div className="wrap page-head">
        <h1>Mes favoris</h1>
        <p className="lede">Gardés sur cet appareil, sans compte. Les prix et la disponibilité sont à jour.</p>
      </div>
      <div className="wrap">
        <FavoritesView />
      </div>
    </>
  );
}
