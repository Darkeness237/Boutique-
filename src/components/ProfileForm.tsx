"use client";

import { useActionState } from "react";
import { deleteAccount, updateProfile, type FormState } from "@/app/compte/actions";
import { DeliveryFields, Field, type Zone } from "./DeliveryFields";

export function ProfileForm({ initial, zones }: { initial: Record<string, string | boolean>; zones: Zone[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfile, { values: initial });
  const values = state.values ?? initial;
  return (
    <form className="form" action={action} noValidate>
      <DeliveryFields
        errors={state.errors ?? {}}
        values={values}
        zones={zones}
        defaultCountry={values.country === "cm" ? "cm" : "fr"}
      />
      <label className="consent">
        <input type="checkbox" name="newsletter" defaultChecked={values.newsletter === true} />
        <span>Recevoir nos bons plans par e-mail (une fois par semaine au plus).</span>
      </label>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
      <p role="status" className={state.notice ? `form-notice${state.ok ? " form-notice-ok" : ""}` : undefined}>
        {state.notice}
      </p>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccount, {});
  return (
    <form className="form" action={action}>
      <p className="field-hint">
        Votre compte, votre adresse et vos préférences sont effacés. Les factures des commandes passées sont
        conservées 10 ans, comme la loi l&apos;impose, sans être rattachées à un compte.
      </p>
      <Field name="confirm" label="Tapez SUPPRIMER pour confirmer" errors={state.errors ?? {}} values={undefined} autoComplete="off" />
      <button type="submit" className="btn btn-quiet" disabled={pending}>
        Supprimer mon compte
      </button>
      <p role="status">{state.notice}</p>
    </form>
  );
}
