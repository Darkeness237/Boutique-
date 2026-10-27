"use client";

import { useState } from "react";
import type { FieldErrors } from "@/lib/auth-schema";

export type Zone = { slug: string; city: string };
type Values = Record<string, string | boolean> | undefined;

/** Champ texte avec libellé, message d'erreur relié et valeur conservée après envoi. */
export function Field({
  name,
  label,
  errors,
  values,
  hint,
  ...input
}: {
  name: string;
  label: string;
  errors: FieldErrors;
  values: Values;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const error = errors[name];
  const value = values?.[name];
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        defaultValue={typeof value === "string" ? value : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        {...input}
      />
      {hint && !error && (
        <p id={`${name}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Coordonnées de livraison. En France : adresse postale complète.
 * Au Cameroun : ville desservie par notre livreur, quartier et point de repère.
 */
export function DeliveryFields({
  errors,
  values,
  zones,
  defaultCountry,
}: {
  errors: FieldErrors;
  values: Values;
  zones: Zone[];
  defaultCountry: "fr" | "cm";
}) {
  const [country, setCountry] = useState<"fr" | "cm">(
    values?.country === "cm" || values?.country === "fr" ? values.country : defaultCountry,
  );
  const cm = country === "cm";
  const zone = typeof values?.cmZone === "string" ? values.cmZone : "";

  return (
    <fieldset className="form-group">
      <legend>Livraison</legend>
      <div className="field-row">
        <Field name="firstName" label="Prénom" errors={errors} values={values} autoComplete="given-name" maxLength={60} />
        <Field name="lastName" label="Nom" errors={errors} values={values} autoComplete="family-name" maxLength={60} />
      </div>

      <div className="field">
        <span className="field-label" id="country-label">
          Pays de livraison
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="country-label">
          {(
            [
              ["fr", "France"],
              ["cm", "Cameroun"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className={country === value ? "is-on" : undefined}>
              <input
                type="radio"
                name="country"
                value={value}
                checked={country === value}
                onChange={() => setCountry(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {cm ? (
        <div className="field">
          <label htmlFor="cmZone">Ville</label>
          <select
            id="cmZone"
            name="cmZone"
            defaultValue={zone}
            aria-invalid={errors.cmZone ? true : undefined}
            aria-describedby={errors.cmZone ? "cmZone-error" : undefined}
          >
            <option value="" disabled>
              Choisissez votre ville
            </option>
            {zones.map((z) => (
              <option key={z.slug} value={z.slug}>
                {z.city}
              </option>
            ))}
          </select>
          {errors.cmZone && (
            <p id="cmZone-error" className="field-error">
              {errors.cmZone}
            </p>
          )}
        </div>
      ) : null}

      <Field
        name="address1"
        label={cm ? "Quartier et rue" : "Adresse"}
        errors={errors}
        values={values}
        autoComplete="address-line1"
        maxLength={120}
        placeholder={cm ? "Bonapriso, rue Njo-Njo" : "12 rue de la Paix"}
      />
      <Field
        name="address2"
        label={cm ? "Point de repère (facultatif)" : "Complément (facultatif)"}
        errors={errors}
        values={values}
        autoComplete="address-line2"
        maxLength={120}
        placeholder={cm ? "En face de la pharmacie, portail bleu" : "Bâtiment, étage, digicode"}
      />

      {!cm && (
        <div className="field-row field-row-postal">
          <Field
            name="postalCode"
            label="Code postal"
            errors={errors}
            values={values}
            autoComplete="postal-code"
            inputMode="numeric"
            maxLength={5}
          />
          <Field name="city" label="Ville" errors={errors} values={values} autoComplete="address-level2" maxLength={60} />
        </div>
      )}

      <Field
        name="phone"
        label="Téléphone"
        errors={errors}
        values={values}
        type="tel"
        autoComplete="tel"
        maxLength={20}
        hint={
          cm
            ? "Le livreur vous appelle avant de passer. Ce numéro peut aussi servir au paiement Mobile Money."
            : "Le transporteur vous prévient le jour de la livraison."
        }
      />
    </fieldset>
  );
}
