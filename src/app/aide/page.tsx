import type { Metadata } from "next";
import Link from "next/link";
import { FREE_SHIPPING_CENTS, SHIPPING_CENTS } from "@/lib/cart";
import { SUPPORT_EMAIL, whatsappLink } from "@/lib/contact";
import { formatPrice } from "@/lib/format";
import { CAMEROON_ENABLED } from "@/lib/market";

export const metadata: Metadata = {
  title: "Centre d'aide",
  description: "Commander, livraison, paiement, garantie, retours et suivi de commande.",
};

const SECTIONS: { id: string; title: string; items: [string, React.ReactNode][] }[] = [
  {
    id: "commander",
    title: "Commander",
    items: [
      ["Comment passer commande ?", <>Ajoutez vos produits au panier, puis cliquez sur « Passer au paiement ». Un compte n&apos;est pas obligatoire, mais il enregistre votre adresse et vos commandes.</>],
      ["Comment être sûr que mes pièces sont compatibles ?", <>Chaque fiche indique le socket, le type de mémoire ou la puissance utile. La <Link href="/#config">config du moment</Link> est vérifiée pour vous. En cas de doute, écrivez-nous avant de commander.</>],
      ["Puis-je modifier ou annuler ma commande ?", <>Oui, tant qu&apos;elle n&apos;est pas expédiée : contactez-nous au plus vite avec votre numéro de commande (SIL-…).</>],
    ],
  },
  {
    id: "livraison",
    title: "Livraison et délais",
    items: [
      ["France", <>Livraison à domicile en 3 à 6 jours ouvrés. Frais : {formatPrice(SHIPPING_CENTS)}, offerts dès {formatPrice(FREE_SHIPPING_CENTS)} d&apos;achat.</>],
      ["Cameroun", <>Livraison à domicile à Douala et Yaoundé, en 2 à 4 semaines selon le produit (transport aérien depuis la France et dédouanement). Les prix affichés en FCFA comprennent le transport, la douane et la TVA camerounaise ; la livraison à domicile s&apos;ajoute au panier selon le poids du colis (de 2 000 à 3 500 FCFA).</>],
      ["Comment suivre ma commande ?", <>Depuis <Link href="/compte">Mon compte</Link>, ou sans compte sur la page <Link href="/suivi">Suivre ma commande</Link> avec votre numéro et votre e-mail.</>],
    ],
  },
  {
    id: "paiement",
    title: "Paiement",
    items: [
      ["France", <>Carte bancaire, Apple Pay ou Google Pay, sur la page sécurisée de Stripe. Nous ne voyons jamais votre numéro de carte.</>],
      ["Cameroun", <>Le paiement par Orange Money et MTN MoMo arrive bientôt. En attendant, contactez-nous pour commander.</>],
      ["Les prix sont-ils TTC ?", <>Oui : ce sont les prix que vous payez (TVA non applicable, art. 293 B du CGI).</>],
    ],
  },
  {
    id: "garantie",
    title: "Garantie, panne et retours",
    items: [
      ["Quelle garantie ?", <>Tous les produits bénéficient de la garantie légale de conformité de 2 ans. En cas de panne, nous organisons le retour et l&apos;échange avec le fabricant.</>],
      ["Je change d'avis (France)", <>Vous disposez de 14 jours après réception pour nous retourner un produit non utilisé, dans son emballage d&apos;origine.</>],
      ["Mon produit ne fonctionne pas", <>Contactez-nous avec votre numéro de commande et une description (une photo ou une vidéo aide beaucoup). Nous vous répondons sous 48 heures ouvrées.</>],
    ],
  },
];

export default function HelpCenter() {
  const wa = whatsappLink("Bonjour Vetex PC, j'ai besoin d'aide : ");
  return (
    <div className="wrap help-page">
      <div className="page-head">
        <h1>Centre d&apos;aide</h1>
        <p className="lede">Les réponses aux questions les plus fréquentes. Vous ne trouvez pas ? Écrivez-nous.</p>
        <nav className="sub-chips" aria-label="Rubriques">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="chip">
              {s.title}
            </a>
          ))}
          <Link href="/suivi" className="chip">
            Suivre ma commande
          </Link>
        </nav>
      </div>
      {SECTIONS.map((s) => (
        <section key={s.id} id={s.id} className="help-section" aria-labelledby={`${s.id}-t`}>
          <h2 id={`${s.id}-t`}>{s.title}</h2>
          {s.items.filter(([q]) => CAMEROON_ENABLED || q !== "Cameroun").map(([q, a]) => (
            <details key={q} className="faq">
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
      ))}
      <section className="help-section help-contact">
        <h2>Nous contacter</h2>
        <p>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">
              💬 WhatsApp
            </a>
          )}{" "}
          {SUPPORT_EMAIL && (
            <a href={`mailto:${SUPPORT_EMAIL}`} className="btn btn-quiet">
              ✉️ {SUPPORT_EMAIL}
            </a>
          )}
          {!wa && !SUPPORT_EMAIL && <span className="field-hint">Coordonnées bientôt disponibles.</span>}
        </p>
        <p className="field-hint">
          Voir aussi les <Link href="/cgv">conditions générales de vente</Link>.
        </p>
      </section>
    </div>
  );
}
