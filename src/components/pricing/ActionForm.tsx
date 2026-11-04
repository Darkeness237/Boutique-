"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/pricing-actions";

/** Formulaire relié à une action serveur, avec message de résultat. */
export function ActionForm({
  action,
  children,
  submit,
  className = "form form-compact",
  encType,
}: {
  action: (prev: ActionState, data: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submit: string;
  className?: string;
  encType?: "multipart/form-data";
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className={className} encType={encType}>
      {children}
      <button className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? "Un instant…" : submit}
      </button>
      <p role="status" className={state.notice ? `form-notice${state.ok ? " form-notice-ok" : ""}` : undefined}>
        {state.notice}
      </p>
    </form>
  );
}
