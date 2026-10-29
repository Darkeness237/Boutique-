"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import {
  createForwarder,
  createShipment,
  inviteStaff,
  postMessage,
  prepareUpload,
  receiveShipment,
  recordDocument,
  updateStep,
  type ActionState,
} from "@/lib/transit-actions";
import { CONDITIONS, DOC_KINDS, MAX_UPLOAD, MIME_EXT, STATUSES, STEPS, type DocKind } from "@/lib/transit";

function Notice({ state }: { state: ActionState }) {
  if (!state.notice) return <p role="status" />;
  return (
    <p role="status" className={`form-notice${state.ok ? " form-notice-ok" : ""}`}>
      {state.notice}
    </p>
  );
}

export function ReceiveForm({ id, defaults }: { id: string; defaults?: { parcels?: number | null; weight?: number | null } }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(receiveShipment, {});
  return (
    <form action={action} className="form form-compact">
      <input type="hidden" name="id" value={id} />
      <div className="field-row">
        <div className="field">
          <label htmlFor="parcels">Nombre de colis reçus</label>
          <input id="parcels" name="parcels" type="number" min={0} max={999} required defaultValue={defaults?.parcels ?? undefined} />
        </div>
        <div className="field">
          <label htmlFor="weight">Poids total (kg)</label>
          <input id="weight" name="weight" inputMode="decimal" required defaultValue={defaults?.weight ?? undefined} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="condition">État</label>
        <select id="condition" name="condition" defaultValue="ok">
          {Object.entries(CONDITIONS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="rnote">Remarque (facultatif)</label>
        <textarea id="rnote" name="note" maxLength={1500} rows={2} placeholder="Carton enfoncé sur un côté, contenu vérifié…" />
      </div>
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Enregistrement…" : "Valider la réception"}
      </button>
      <Notice state={state} />
    </form>
  );
}

export function StepForm({ id, isAdmin }: { id: string; isAdmin: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateStep, {});
  const [status, setStatus] = useState("en_preparation");
  const steps = isAdmin ? (Object.keys(STATUSES) as (keyof typeof STATUSES)[]) : STEPS;
  return (
    <form action={action} className="form form-compact">
      <input type="hidden" name="id" value={id} />
      <div className="field">
        <label htmlFor="status">Étape</label>
        <select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {steps.map((s) => (
            <option key={s} value={s}>
              {STATUSES[s]}
            </option>
          ))}
        </select>
      </div>
      {status === "expedie" && (
        <>
          <div className="field-row">
            <div className="field">
              <label htmlFor="mode">Transport</label>
              <select id="mode" name="mode" defaultValue="aerien">
                <option value="aerien">Aérien</option>
                <option value="maritime">Maritime</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="eta">Arrivée prévue</label>
              <input id="eta" name="eta" type="date" />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="awb">N° LTA / connaissement</label>
              <input id="awb" name="awb" maxLength={60} />
            </div>
            <div className="field">
              <label htmlFor="carrier">Compagnie / vol</label>
              <input id="carrier" name="carrier" maxLength={80} placeholder="Air France AF946" />
            </div>
          </div>
        </>
      )}
      <div className="field">
        <label htmlFor="location">Lieu (facultatif)</label>
        <input id="location" name="location" maxLength={120} placeholder="Roissy CDG, aéroport de Douala…" />
      </div>
      <div className="field">
        <label htmlFor="snote">Commentaire (facultatif)</label>
        <textarea id="snote" name="note" maxLength={2000} rows={2} />
      </div>
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer l'étape"}
      </button>
      <Notice state={state} />
    </form>
  );
}

export function MessageForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(postMessage, {});
  return (
    <form action={action} className="form form-compact message-form">
      <input type="hidden" name="id" value={id} />
      <label htmlFor="message" className="visually-hidden">
        Message
      </label>
      <textarea id="message" name="message" maxLength={2000} rows={2} required placeholder="Écrire un message…" />
      <button className="btn btn-dark btn-sm" disabled={pending}>
        Envoyer
      </button>
      {!state.ok && <Notice state={state} />}
    </form>
  );
}

export function UploadForm({ id }: { id: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<DocKind>("preuve_export");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return setNotice({ ok: false, text: "Choisissez un fichier." });
    if (!MIME_EXT[file.type] || file.size > MAX_UPLOAD) {
      return setNotice({ ok: false, text: "PDF, JPG, PNG, WEBP ou HEIC de 15 Mo au plus." });
    }
    setBusy(true);
    setNotice(null);
    try {
      const ticket = await prepareUpload({ id, kind, type: file.type, size: file.size });
      if ("error" in ticket) throw new Error(ticket.error);
      // Envoi direct au stockage privé avec l'autorisation à usage unique.
      const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      }).storage;
      const { error } = await storage.from("transit").uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
      if (error) throw new Error("L'envoi du fichier a échoué. Réessayez.");
      const saved = await recordDocument({ id, kind, path: ticket.path, filename: file.name });
      if ("error" in saved) throw new Error(saved.error);
      setNotice({ ok: true, text: "Document ajouté." });
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "Échec de l'envoi." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="form form-compact">
      <div className="field">
        <label htmlFor="kind">Type de document</label>
        <select id="kind" value={kind} onChange={(e) => setKind(e.target.value as DocKind)}>
          {Object.entries(DOC_KINDS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="file">Fichier (PDF ou photo, 15 Mo max.)</label>
        <input id="file" ref={fileRef} type="file" accept=".pdf,image/jpeg,image/png,image/webp,image/heic" capture={undefined} />
      </div>
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Envoi…" : "Ajouter le document"}
      </button>
      <p role="status" className={notice ? `form-notice${notice.ok ? " form-notice-ok" : ""}` : undefined}>
        {notice?.text}
      </p>
    </form>
  );
}

// Admin ---------------------------------------------------------------------------------------------
type Option = { id: string; name: string };

export function NewShipmentForm({ forwarders, cities }: { forwarders: Option[]; cities: string[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createShipment, {});
  if (forwarders.length === 0) {
    return <p className="field-hint">Créez d&apos;abord une société de transit dans l&apos;onglet Transitaires.</p>;
  }
  return (
    <form action={action} className="form form-compact">
      <div className="field-row">
        <div className="field">
          <label htmlFor="forwarder_id">Transitaire</label>
          <select id="forwarder_id" name="forwarder_id" defaultValue={forwarders[0].id}>
            {forwarders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="order_number">N° de commande (facultatif)</label>
          <input id="order_number" name="order_number" maxLength={20} placeholder="SIL-1001" />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="customer_name">Client</label>
          <input id="customer_name" name="customer_name" maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="customer_city">Ville</label>
          <select id="customer_city" name="customer_city" defaultValue={cities[0]}>
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="contents">Contenu</label>
        <textarea id="contents" name="contents" rows={3} maxLength={2000} required placeholder="1 × carte graphique RTX 5070, 1 × SSD 1 To…" />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="expected_parcels">Colis attendus</label>
          <input id="expected_parcels" name="expected_parcels" type="number" min={1} max={999} />
        </div>
        <div className="field">
          <label htmlFor="expected_weight_kg">Poids estimé (kg)</label>
          <input id="expected_weight_kg" name="expected_weight_kg" inputMode="decimal" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="supplier_tracking">Suivi du fournisseur vers l&apos;entrepôt (facultatif)</label>
        <input id="supplier_tracking" name="supplier_tracking" maxLength={120} placeholder="Colissimo 6A…, DPD…" />
      </div>
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Création…" : "Créer l'expédition"}
      </button>
      <Notice state={state} />
    </form>
  );
}

export function ForwarderForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createForwarder, {});
  return (
    <form action={action} className="form form-compact">
      <div className="field-row">
        <div className="field">
          <label htmlFor="name">Société</label>
          <input id="name" name="name" required maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="phone">Téléphone</label>
          <input id="phone" name="phone" maxLength={40} type="tel" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="contact_email">E-mail de contact</label>
        <input id="contact_email" name="contact_email" type="email" maxLength={254} />
      </div>
      <div className="field">
        <label htmlFor="warehouse_address">Adresse de l&apos;entrepôt (Île-de-France)</label>
        <input id="warehouse_address" name="warehouse_address" maxLength={300} />
      </div>
      <button className="btn btn-primary" disabled={pending}>
        Ajouter la société
      </button>
      <Notice state={state} />
    </form>
  );
}

export function InviteForm({ forwarders }: { forwarders: Option[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(inviteStaff, {});
  const [role, setRole] = useState("forwarder");
  return (
    <form action={action} className="form form-compact">
      <div className="field">
        <label htmlFor="iemail">Adresse e-mail de la personne</label>
        <input id="iemail" name="email" type="email" required maxLength={254} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="role">Accès</label>
          <select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="forwarder">Transitaire</option>
            <option value="admin">Administrateur</option>
          </select>
        </div>
        {role === "forwarder" && (
          <div className="field">
            <label htmlFor="iforwarder">Société</label>
            <select id="iforwarder" name="forwarder_id" defaultValue={forwarders[0]?.id}>
              {forwarders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <button className="btn btn-primary" disabled={pending || (role === "forwarder" && forwarders.length === 0)}>
        Inviter
      </button>
      <Notice state={state} />
    </form>
  );
}
