// Régime de TVA de l'entreprise. Une micro-entreprise en franchise en base ne facture pas la TVA
// et doit l'indiquer. Passer à "assujetti" si l'entreprise collecte la TVA.
export const VAT_MODE: "franchise" | "assujetti" =
  process.env.NEXT_PUBLIC_VAT_MODE === "assujetti" ? "assujetti" : "franchise";

export const PRICE_NOTE = VAT_MODE === "franchise" ? "TVA non applicable, art. 293 B du CGI" : "TVA incluse";
export const TOTAL_LABEL = VAT_MODE === "franchise" ? "Total" : "Total TTC";
