import { supabaseForUser } from "@/lib/supabase-server";
import {
  CONDITIONS,
  DOC_KINDS,
  ORDERED,
  STATUSES,
  dateOnly,
  dateTime,
  missingExportProof,
  type Shipment,
  type ShipmentDocument,
  type ShipmentEvent,
} from "@/lib/transit";
import { MessageForm, ReceiveForm, StepForm, UploadForm } from "./TransitForms";

/** Vue d'une expédition, commune à l'admin et au transitaire (les droits sont vérifiés par la base). */
export async function ShipmentView({ shipment: s, viewer }: { shipment: Shipment; viewer: "admin" | "forwarder" }) {
  const supabase = await supabaseForUser();
  const [{ data: events }, { data: docs }] = await Promise.all([
    supabase
      .from("shipment_events")
      .select("id, kind, status, location, message, author_role, created_at")
      .eq("shipment_id", s.id)
      .order("created_at", { ascending: false })
      .returns<ShipmentEvent[]>(),
    supabase
      .from("shipment_documents")
      .select("id, kind, filename, size_bytes, uploader_role, created_at")
      .eq("shipment_id", s.id)
      .order("created_at", { ascending: false })
      .returns<ShipmentDocument[]>(),
  ]);
  const documents = docs ?? [];
  const stepIndex = ORDERED.indexOf(s.status);
  const noProof = missingExportProof(s, documents);
  const who = (role: string) => (role === viewer ? "Vous" : role === "admin" ? "Vetex PC" : "Transitaire");

  return (
    <div className="transit-grid">
      <div className="transit-main">
        <section className="account-card">
          <ol className="steps" aria-label="Acheminement">
            {ORDERED.map((st, i) => (
              <li key={st} className={i < stepIndex ? "is-done" : i === stepIndex ? "is-current" : undefined}>
                <span>{STATUSES[st]}</span>
              </li>
            ))}
          </ol>
          {s.status === "incident" && <p className="form-notice">Incident signalé : voir le fil ci-dessous.</p>}
          {noProof && (
            <p className="form-notice">
              Preuve d&apos;export manquante : l&apos;expédition est partie depuis plus de 7 jours. Ce document justifie la vente
              sans TVA française.
            </p>
          )}
          <dl className="facts">
            <div><dt>Contenu</dt><dd>{s.contents}</dd></div>
            {s.customer_name && <div><dt>Destinataire</dt><dd>{s.customer_name}{s.customer_city ? `, ${s.customer_city}` : ""}</dd></div>}
            {s.order_number && <div><dt>Commande</dt><dd>{s.order_number}</dd></div>}
            {s.supplier_tracking && <div><dt>Suivi vers l&apos;entrepôt</dt><dd>{s.supplier_tracking}</dd></div>}
            <div>
              <dt>Attendu</dt>
              <dd>
                {s.expected_parcels ? `${s.expected_parcels} colis` : "—"}
                {s.expected_weight_kg ? ` · ${s.expected_weight_kg} kg estimés` : ""}
              </dd>
            </div>
            {s.received_at && (
              <div>
                <dt>Reçu</dt>
                <dd>
                  {dateTime.format(new Date(s.received_at))} · {s.received_parcels} colis · {s.received_weight_kg} kg ·{" "}
                  {s.received_condition ? CONDITIONS[s.received_condition] : ""}
                </dd>
              </div>
            )}
            {(s.awb_number || s.carrier) && (
              <div>
                <dt>Transport</dt>
                <dd>
                  {s.transport_mode === "maritime" ? "Maritime" : "Aérien"}
                  {s.carrier ? ` · ${s.carrier}` : ""}
                  {s.awb_number ? ` · LTA ${s.awb_number}` : ""}
                  {s.eta ? ` · arrivée prévue le ${dateOnly.format(new Date(s.eta))}` : ""}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="account-card">
          <h2>Fil de l&apos;expédition</h2>
          <MessageForm id={s.id} />
          <ul className="timeline">
            {(events ?? []).map((e) => (
              <li key={e.id} className={`tl-${e.kind}`}>
                <p className="tl-head">
                  <strong>
                    {e.kind === "statut" && e.status ? STATUSES[e.status] : e.kind === "document" ? "Document ajouté" : who(e.author_role)}
                  </strong>
                  <span>
                    {e.kind !== "message" && `${who(e.author_role)} · `}
                    {dateTime.format(new Date(e.created_at))}
                  </span>
                </p>
                {e.location && <p className="field-hint">{e.location}</p>}
                {e.message && <p className="tl-msg">{e.kind === "document" ? docLabel(e.message) : e.message}</p>}
              </li>
            ))}
            {(events ?? []).length === 0 && <li className="field-hint">Rien pour l&apos;instant.</li>}
          </ul>
        </section>
      </div>

      <aside className="transit-side">
        {(s.status === "attendu" || viewer === "admin") && (
          <section className="account-card">
            <h2>{s.received_at ? "Corriger la réception" : "Valider la réception"}</h2>
            <ReceiveForm id={s.id} defaults={{ parcels: s.received_parcels ?? s.expected_parcels, weight: s.received_weight_kg }} />
          </section>
        )}
        {(s.status !== "attendu" || viewer === "admin") && (
          <section className="account-card">
            <h2>Mettre à jour l&apos;acheminement</h2>
            <StepForm id={s.id} isAdmin={viewer === "admin"} />
          </section>
        )}
        <section className="account-card">
          <h2>Documents</h2>
          <ul className="doc-list">
            {documents.map((d) => (
              <li key={d.id}>
                <a href={`/api/transit/document/${d.id}`} target="_blank" rel="noopener noreferrer">
                  {DOC_KINDS[d.kind]}
                </a>
                <span className="field-hint">
                  {d.filename} · {who(d.uploader_role)} · {dateOnly.format(new Date(d.created_at))}
                </span>
              </li>
            ))}
            {documents.length === 0 && <li className="field-hint">Aucun document.</li>}
          </ul>
          <UploadForm id={s.id} />
        </section>
      </aside>
    </div>
  );
}

function docLabel(message: string) {
  const [kind, ...rest] = message.split(" : ");
  return `${DOC_KINDS[kind as keyof typeof DOC_KINDS] ?? kind} : ${rest.join(" : ")}`;
}
