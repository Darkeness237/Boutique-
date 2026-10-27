"use server";

import { redirect } from "next/navigation";
import {
  deliverySchema,
  fieldErrors,
  formInput,
  loginSchema,
  signupSchema,
  toProfileRow,
  type FieldErrors,
} from "@/lib/auth-schema";
import { supabaseForUser } from "@/lib/supabase-server";

export type FormState = {
  errors?: FieldErrors;
  notice?: string;
  ok?: boolean;
  // Valeurs renvoyées pour re-remplir le formulaire (jamais le mot de passe).
  values?: Record<string, string | boolean>;
};

function keep(input: ReturnType<typeof formInput>): FormState["values"] {
  const { password: _password, ...rest } = input;
  return rest;
}

function site() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function signUp(_prev: FormState, data: FormData): Promise<FormState> {
  const input = formInput(data);
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: keep(input) };
  const v = parsed.data;

  const supabase = await supabaseForUser();
  const { data: result, error } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      emailRedirectTo: `${site()}/auth/callback`,
      // Les champs de livraison sont copiés dans le profil par la base, puis retirés des métadonnées.
      data: {
        first_name: v.firstName,
        newsletter: v.newsletter,
        livraison: {
          last_name: v.lastName,
          phone: v.phone,
          country: v.country,
          address_line1: v.address1,
          address_line2: v.address2 ?? "",
          postal_code: v.country === "fr" ? v.postalCode : "",
          city: v.country === "fr" ? v.city : "",
          cm_zone: v.country === "cm" ? v.cmZone : "",
        },
      },
    },
  });
  if (error) {
    console.error("Inscription :", error.message);
    const weak = /password/i.test(error.message);
    return {
      errors: weak ? { password: "Ce mot de passe est trop courant, choisissez-en un autre." } : {},
      notice: weak ? undefined : "L'inscription n'a pas abouti. Réessayez dans quelques minutes.",
      values: keep(input),
    };
  }
  if (result.session) redirect("/compte");
  // Même message que l'adresse soit déjà inscrite ou non : on ne révèle pas qui a un compte.
  return {
    ok: true,
    notice: `Presque terminé : ouvrez l'e-mail envoyé à ${v.email} et cliquez sur le lien pour activer votre compte.`,
  };
}

export async function signIn(_prev: FormState, data: FormData): Promise<FormState> {
  const input = formInput(data);
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: keep(input) };

  const supabase = await supabaseForUser();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const unconfirmed = /confirm/i.test(error.message);
    return {
      notice: unconfirmed
        ? "Activez d'abord votre compte avec le lien reçu par e-mail."
        : "Adresse e-mail ou mot de passe incorrect.",
      values: { email: parsed.data.email },
    };
  }
  redirect("/compte");
}

export async function signOut() {
  const supabase = await supabaseForUser();
  await supabase.auth.signOut();
  redirect("/");
}

export async function updateProfile(_prev: FormState, data: FormData): Promise<FormState> {
  const input = formInput(data);
  const parsed = deliverySchema.safeParse(input);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: keep(input) };

  const supabase = await supabaseForUser();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/connexion");
  // La politique RLS garantit qu'on ne peut modifier que son propre profil.
  const { error } = await supabase.from("profiles").update(toProfileRow(parsed.data)).eq("id", auth.user.id);
  if (error) {
    console.error("Profil :", error.message);
    return { notice: "L'enregistrement n'a pas abouti. Réessayez.", values: keep(input) };
  }
  return { ok: true, notice: "Vos coordonnées sont enregistrées.", values: keep(input) };
}

export async function deleteAccount(_prev: FormState, data: FormData): Promise<FormState> {
  if (String(data.get("confirm") ?? "").trim().toUpperCase() !== "SUPPRIMER") {
    return { errors: { confirm: "Tapez SUPPRIMER pour confirmer." } };
  }
  const supabase = await supabaseForUser();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    console.error("Suppression du compte :", error.message);
    return { notice: "La suppression n'a pas abouti. Écrivez-nous et nous la ferons pour vous." };
  }
  await supabase.auth.signOut();
  redirect("/?compte=supprime");
}
