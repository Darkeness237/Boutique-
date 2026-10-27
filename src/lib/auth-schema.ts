import { z } from "zod";

// Ces règles seront réutilisées côté serveur : la validation dans le navigateur
// aide l'utilisateur, mais seule celle du serveur protège.
const email = z.string().trim().toLowerCase().max(254).email("Saisissez une adresse e-mail valide.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Saisissez votre mot de passe.").max(128),
});

export const signupSchema = z.object({
  firstName: z.string().trim().min(1, "Saisissez votre prénom.").max(60),
  email,
  // Longueur plutôt que règles de complexité (recommandation ANSSI / NIST).
  password: z
    .string()
    .min(12, "Le mot de passe doit contenir au moins 12 caractères.")
    .max(128, "Le mot de passe doit contenir au plus 128 caractères."),
  terms: z.literal(true, { message: "Acceptez les conditions générales pour créer un compte." }),
  newsletter: z.boolean(),
});
