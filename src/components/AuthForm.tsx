"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { fieldErrors, formInput, loginSchema, signupSchema, type FieldErrors } from "@/lib/auth-schema";
import { signIn, signUp, type FormState } from "@/app/compte/actions";
import { DeliveryFields, Field, type Zone } from "./DeliveryFields";

export function AuthForm({
  mode,
  zones = [],
  defaultCountry = "fr",
}: {
  mode: "login" | "signup";
  zones?: Zone[];
  defaultCountry?: "fr" | "cm";
}) {
  const isSignup = mode === "signup";
  const [state, action, pending] = useActionState<FormState, FormData>(isSignup ? signUp : signIn, {});
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);
  const errors = clientErrors ?? state.errors ?? {};

  // Validation immédiate dans le navigateur ; le serveur revalide de toute façon.
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const result = (isSignup ? signupSchema : loginSchema).safeParse(formInput(new FormData(event.currentTarget)));
    if (!result.success) {
      event.preventDefault();
      setClientErrors(fieldErrors(result.error));
      return;
    }
    setClientErrors(null);
  }

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
        <GoogleMark />
        Continuer avec Google
      </a>
      <p className="auth-or">
        <span>ou avec votre e-mail</span>
      </p>

      <form className="form" action={action} onSubmit={onSubmit} noValidate>
        <Field name="email" label="Adresse e-mail" errors={errors} values={state.values} type="email" autoComplete="email" maxLength={254} />
        <Field
          name="password"
          label="Mot de passe"
          errors={errors}
          values={undefined}
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          maxLength={128}
          hint={isSignup ? "12 caractères minimum. Une phrase fonctionne très bien." : undefined}
        />

        {isSignup && (
          <>
            <DeliveryFields errors={errors} values={state.values} zones={zones} defaultCountry={defaultCountry} />
            <label className="consent">
              <input type="checkbox" name="terms" aria-describedby={errors.terms ? "terms-error" : undefined} />
              <span>
                J&apos;accepte les <Link href="/cgv">conditions générales de vente</Link> et j&apos;ai lu la{" "}
                <Link href="/confidentialite">politique de confidentialité</Link>.
              </span>
            </label>
            {errors.terms && (
              <p id="terms-error" className="field-error">
                {errors.terms}
              </p>
            )}
            <label className="consent">
              <input type="checkbox" name="newsletter" defaultChecked={state.values?.newsletter === true} />
              <span>Recevoir nos bons plans par e-mail (une fois par semaine au plus, désinscription en un clic).</span>
            </label>
          </>
        )}

        <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
          {pending ? "Un instant…" : isSignup ? "Créer mon compte" : "Se connecter"}
        </button>
        <p role="status" className={state.notice ? "form-notice" : undefined}>
          {state.notice}
        </p>
      </form>
    </>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.4 30.4 0 24 0 14.6 0 6.6 5.4 2.7 13.3l8 6.2C12.6 13.6 17.9 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
      <path fill="#FBBC05" d="M10.7 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-8-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l8-6.2z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.1 0-11.3-4.1-13.2-9.7l-8 6.2C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
