"use client";

import { useActionState } from "react";
import { STATUSES } from "@/lib/transit";
import { trackOrder, type TrackState } from "./actions";

const ORDER_STATUS: Record<string, string> = {
  payee: "Payée, en cours de préparation",
  commandee_fournisseur: "Commandée auprès de notre fournisseur",
  expediee: "Expédiée",
  livree: "Livrée",
  annulee: "Annulée",
  remboursee: "Remboursée",
};
const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });

export function TrackForm() {
  const [state, action, pending] = useActionState<TrackState, FormData>(trackOrder, {});
  const r = state.result;
  return (
    <>
      <form action={action} className="form">
        <div className="field">
          <label htmlFor="number">Numéro de commande</label>
          <input id="number" name="number" placeholder="SIL-1001" required maxLength={14} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="email">Adresse e-mail de la commande</label>
          <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" />
        </div>
        <button className="btn btn-primary btn-lg" disabled={pending}>
          {pending ? "Recherche…" : "Voir où en est ma commande"}
        </button>
        {state.error && (
          <p role="status" className="form-notice">
            {state.error}
          </p>
        )}
      </form>
      {r && (
        <section className="account-card section-gap" aria-live="polite">
          <h2>{r.number}</h2>
          <p className="field-hint">Passée le {date.format(new Date(r.created_at))}</p>
          <p>
            <strong>{ORDER_STATUS[r.status] ?? r.status}</strong>
          </p>
          {r.shipment_status && (
            <p>
              Acheminement vers le Cameroun : <strong>{STATUSES[r.shipment_status as keyof typeof STATUSES] ?? r.shipment_status}</strong>
              {r.shipment_eta ? ` · arrivée prévue le ${date.format(new Date(r.shipment_eta))}` : ""}
            </p>
          )}
          {r.tracking && <p>Suivi du colis : {r.tracking}</p>}
        </section>
      )}
    </>
  );
}
