import type { Metadata } from "next";
import { TrackForm } from "./TrackForm";

export const metadata: Metadata = { title: "Suivre ma commande", robots: { index: false } };

export default function TrackPage() {
  return (
    <div className="wrap">
      <div className="auth">
        <h1>Suivre ma commande</h1>
        <p className="lede">Le numéro (SIL-…) figure dans l&apos;e-mail de confirmation et sur la page de remerciement.</p>
        <TrackForm />
      </div>
    </div>
  );
}
