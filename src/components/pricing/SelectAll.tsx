"use client";

/** Case « tout sélectionner » pour les validations en masse. */
export function SelectAll({ form }: { form: string }) {
  return (
    <input
      type="checkbox"
      aria-label="Tout sélectionner"
      onChange={(e) => {
        const f = document.getElementById(form) as HTMLFormElement | null;
        f?.querySelectorAll<HTMLInputElement>('input[name="id"]').forEach((c) => (c.checked = e.target.checked));
      }}
    />
  );
}
