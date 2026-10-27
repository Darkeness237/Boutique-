import { z } from "zod";

// Ces règles sont appliquées dans le navigateur (pour aider l'utilisateur) puis de nouveau
// côté serveur (seule cette seconde validation protège).
const email = z.string().trim().toLowerCase().max(254).email("Saisissez une adresse e-mail valide.");
const text = (max: number, message: string) => z.string().trim().min(1, message).max(max);
const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Saisissez votre mot de passe.").max(128),
});

/** Coordonnées de livraison : adresse postale en France, ville desservie et repère au Cameroun. */
export const deliverySchema = z
  .object({
    firstName: text(60, "Saisissez votre prénom."),
    lastName: text(60, "Saisissez votre nom."),
    // Le livreur appelle avant de passer : indispensable, surtout au Cameroun.
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 .()-]{6,20}$/, "Saisissez un numéro de téléphone valide (ex. 06 12 34 56 78 ou +237 6 99 00 00 00)."),
    country: z.enum(["fr", "cm"]),
    address1: text(120, "Saisissez votre adresse."),
    address2: optional(120),
    postalCode: optional(10),
    city: optional(60),
    cmZone: optional(40),
    newsletter: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.country === "fr") {
      if (!v.postalCode || !/^\d{5}$/.test(v.postalCode)) {
        ctx.addIssue({ code: "custom", path: ["postalCode"], message: "Saisissez un code postal à 5 chiffres." });
      }
      if (!v.city) ctx.addIssue({ code: "custom", path: ["city"], message: "Saisissez votre ville." });
    } else if (!v.cmZone) {
      ctx.addIssue({ code: "custom", path: ["cmZone"], message: "Choisissez votre ville de livraison." });
    }
  });

export const signupSchema = z
  .object({
    email,
    // Longueur plutôt que règles de complexité (recommandation ANSSI / NIST).
    password: z
      .string()
      .min(12, "Le mot de passe doit contenir au moins 12 caractères.")
      .max(128, "Le mot de passe doit contenir au plus 128 caractères."),
    terms: z.literal(true, { message: "Acceptez les conditions générales pour créer un compte." }),
  })
  .and(deliverySchema);

export type Delivery = z.infer<typeof deliverySchema>;

/** Lit les champs du formulaire (inscription ou profil) dans un objet à valider. */
export function formInput(data: FormData) {
  const s = (k: string) => String(data.get(k) ?? "");
  return {
    email: s("email"),
    password: s("password"),
    terms: data.get("terms") === "on",
    firstName: s("firstName"),
    lastName: s("lastName"),
    phone: s("phone"),
    country: s("country") === "cm" ? "cm" : "fr",
    address1: s("address1"),
    address2: s("address2"),
    postalCode: s("postalCode"),
    city: s("city"),
    cmZone: s("cmZone"),
    newsletter: data.get("newsletter") === "on",
  };
}

export type FieldErrors = Partial<Record<string, string>>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

/** Colonnes de la table profiles correspondant au formulaire. */
export function toProfileRow(v: Delivery) {
  return {
    first_name: v.firstName,
    last_name: v.lastName,
    phone: v.phone,
    country: v.country,
    address_line1: v.address1,
    address_line2: v.address2 ?? null,
    postal_code: v.country === "fr" ? (v.postalCode ?? null) : null,
    city: v.country === "fr" ? (v.city ?? null) : null,
    cm_zone: v.country === "cm" ? (v.cmZone ?? null) : null,
    marketing_opt_in: v.newsletter,
  };
}
