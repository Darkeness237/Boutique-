import type { Metadata } from "next";

export const metadata: Metadata = { title: "Conditions générales de vente" };

// Trame reprenant les obligations du Code de la consommation. À faire relire par un juriste.
export default function CgvPage() {
  return (
    <div className="wrap">
      <article className="prose">
        <h1>Conditions générales de vente</h1>
        <p>
          Version du <span className="todo">[date]</span>. Elles s&apos;appliquent aux commandes passées sur ce site par
          des consommateurs résidant en France métropolitaine.
        </p>
        <h2>Prix</h2>
        <p>Les prix sont indiqués en euros, toutes taxes comprises, hors frais de livraison affichés avant le paiement.</p>
        <h2>Commande et paiement</h2>
        <p>
          La commande est ferme après le paiement. Le paiement par carte est traité par Stripe ; nous n&apos;avons
          jamais accès au numéro de votre carte.
        </p>
        <h2>Livraison</h2>
        <p>
          Expédition sous 24 h ouvrées pour les produits en stock. Délais et tarifs :{" "}
          <span className="todo">[à préciser]</span>.
        </p>
        <h2>Droit de rétractation</h2>
        <p>
          Vous disposez de 14 jours après réception pour nous retourner un produit, sans avoir à vous justifier. Nous
          vous remboursons sous 14 jours après réception du retour, frais de livraison initiaux compris.
        </p>
        <h2>Garanties</h2>
        <p>
          Tous les produits bénéficient de la garantie légale de conformité (2 ans, articles L217-3 et suivants du Code
          de la consommation) et de la garantie des vices cachés (articles 1641 et suivants du Code civil).
        </p>
        <h2>Ventes à destination du Cameroun</h2>
        <p>
          Les prix affichés en francs CFA sont des prix rendus au Cameroun : ils comprennent le transport aérien depuis la France,
          l&apos;assurance, les droits de douane, les taxes à l&apos;importation et la TVA camerounaise. Aucun frais
          supplémentaire n&apos;est demandé à l&apos;arrivée, hormis la livraison à domicile, facturée par colis selon
          son poids (2 000 FCFA jusqu&apos;à 5 kg, 2 500 FCFA jusqu&apos;à 10 kg, 3 500 FCFA au-delà) et affichée avant le paiement.
        </p>
        <p>
          Les produits expédiés au Cameroun sont vendus sans TVA française (exportation hors de l&apos;Union
          européenne). Conversion : 1 € = 655,957 FCFA (parité fixe). Délai indicatif : 2 à 4 semaines entre la
          commande et la livraison, dédouanement compris.
        </p>
        <p>
          Un produit défectueux ou non conforme à la livraison est échangé à nos frais. Conditions de retour pour
          changement d&apos;avis : <span className="todo">[à définir avec le transitaire et à faire valider]</span>.
        </p>
      </article>
    </div>
  );
}
