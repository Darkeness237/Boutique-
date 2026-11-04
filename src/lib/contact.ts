// Coordonnées publiques du service client (variables Netlify ; un élément sans valeur est simplement masqué).

/** Numéro WhatsApp au format international sans « + » ni espaces, ex. 33612345678 ou 237690000000. */
export const WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "") || null;
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || null;

/** Lien WhatsApp avec un message pré-rempli. */
export function whatsappLink(text: string): string | null {
  return WHATSAPP ? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}` : null;
}
