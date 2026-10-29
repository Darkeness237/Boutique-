"use client";

import { useActionState } from "react";
import { signUpPartner, type FormState } from "@/app/compte/actions";

export function PartnerSignupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signUpPartner, {});
  if (state.ok) {
    return (
      <p role="status" className="form-notice form-notice-ok">
        {state.notice}
      </p>
    );
  }
  return (
    <>
      <a href="/auth/google" className="btn btn-google btn-lg">
        Continuer avec Google
      </a>
      <p className="auth-or">
        <span>ou avec votre e-mail</span>
      </p>
      <form action={action} className="form">
        <div className="field">
          <label htmlFor="firstName">Nom et prénom</label>
          <input id="firstName" name="firstName" required maxLength={60} autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="email">Adresse e-mail invitée</label>
          <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">Mot de passe</label>
          <input id="password" name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" />
          <p className="field-hint">12 caractères minimum.</p>
        </div>
        <button className="btn btn-primary btn-lg" disabled={pending}>
          {pending ? "Un instant…" : "Créer mon accès"}
        </button>
        <p role="status" className={state.notice ? "form-notice" : undefined}>
          {state.notice}
        </p>
      </form>
    </>
  );
}
