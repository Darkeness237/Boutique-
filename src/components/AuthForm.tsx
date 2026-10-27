"use client";

import Link from "next/link";
import { useState } from "react";
import { loginSchema, signupSchema } from "@/lib/auth-schema";

type Errors = Partial<Record<string, string>>;

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const isSignup = mode === "signup";

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = {
      firstName: String(data.get("firstName") ?? ""),
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
      terms: data.get("terms") === "on",
      newsletter: data.get("newsletter") === "on",
    };
    const result = (isSignup ? signupSchema : loginSchema).safeParse(input);
    if (!result.success) {
      const next: Errors = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        next[key] ??= issue.message;
      }
      setErrors(next);
      setNotice(null);
      return;
    }
    setErrors({});
    // TODO : appeler Supabase Auth (côté serveur) ; rien n'est envoyé pour l'instant.
    setNotice("Les comptes client seront bientôt disponibles. Aucune donnée n'a été envoyée.");
  }

  const fieldProps = (name: string) => ({
    id: name,
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  const errorFor = (name: string) =>
    errors[name] ? (
      <p id={`${name}-error`} className="field-error">
        {errors[name]}
      </p>
    ) : null;

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      {isSignup && (
        <div className="field">
          <label htmlFor="firstName">Prénom</label>
          <input {...fieldProps("firstName")} type="text" autoComplete="given-name" maxLength={60} />
          {errorFor("firstName")}
        </div>
      )}
      <div className="field">
        <label htmlFor="email">Adresse e-mail</label>
        <input {...fieldProps("email")} type="email" autoComplete="email" maxLength={254} />
        {errorFor("email")}
      </div>
      <div className="field">
        <label htmlFor="password">Mot de passe</label>
        <input
          {...fieldProps("password")}
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          maxLength={128}
        />
        {isSignup && !errors.password && <p className="field-hint">12 caractères minimum. Une phrase fonctionne très bien.</p>}
        {errorFor("password")}
      </div>
      {isSignup && (
        <>
          <label className="consent">
            <input type="checkbox" name="terms" aria-describedby={errors.terms ? "terms-error" : undefined} />
            <span>
              J&apos;accepte les <Link href="/cgv">conditions générales de vente</Link> et j&apos;ai lu la{" "}
              <Link href="/confidentialite">politique de confidentialité</Link>.
            </span>
          </label>
          {errorFor("terms")}
          <label className="consent">
            <input type="checkbox" name="newsletter" />
            <span>Recevoir les promotions par e-mail (une par semaine au plus, désinscription en un clic).</span>
          </label>
        </>
      )}
      <button type="submit" className="btn btn-primary btn-lg">
        {isSignup ? "Créer mon compte" : "Se connecter"}
      </button>
      <p role="status" className={notice ? "form-notice" : undefined}>
        {notice}
      </p>
    </form>
  );
}
