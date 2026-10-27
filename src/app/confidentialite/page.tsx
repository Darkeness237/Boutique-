import type { Metadata } from "next";

export const metadata: Metadata = { title: "Confidentialité et données personnelles" };

// Politique conforme au RGPD dans sa structure ; les éléments entre crochets sont à compléter.
export default function PrivacyPage() {
  return (
    <div className="wrap">
      <article className="prose">
        <h1>Confidentialité et données personnelles</h1>
        <p>
          Responsable du traitement : <span className="todo">[raison sociale, adresse]</span>. Contact pour vos données :{" "}
          <span className="todo">[e-mail dédié]</span>.
        </p>
        <h2>Ce que nous collectons, et pourquoi</h2>
        <ul>
          <li>Pour traiter vos commandes : nom, adresse de livraison, e-mail, téléphone, contenu de la commande.</li>
          <li>Pour votre compte, si vous en créez un : e-mail, prénom et mot de passe (stocké chiffré, jamais en clair).</li>
          <li>Pour les promotions, uniquement si vous l&apos;avez accepté : votre e-mail.</li>
        </ul>
        <p>Nous ne collectons pas vos données bancaires : elles sont saisies et conservées par Stripe.</p>
        <h2>Durée de conservation</h2>
        <ul>
          <li>Commandes et factures : 10 ans (obligation comptable).</li>
          <li>Compte client : supprimé après 3 ans sans connexion.</li>
          <li>Promotions : jusqu&apos;à votre désinscription.</li>
        </ul>
        <h2>Qui y a accès</h2>
        <p>
          Notre équipe, et nos prestataires pour la partie qui les concerne : Stripe (paiement), le transporteur
          (livraison), Supabase (hébergement des données, en Union européenne). Nous ne vendons aucune donnée.
        </p>
        <h2>Cookies et stockage local</h2>
        <p>
          Le site n&apos;utilise ni cookie publicitaire ni outil de mesure d&apos;audience. Votre panier est enregistré
          dans votre navigateur : il ne contient que les produits choisis et leur quantité.
        </p>
        <h2>Vos droits</h2>
        <p>
          Vous pouvez accéder à vos données, les corriger, les supprimer, les exporter ou vous opposer à leur
          utilisation en écrivant à <span className="todo">[e-mail dédié]</span>. Nous répondons sous un mois. Vous
          pouvez aussi saisir la CNIL (cnil.fr).
        </p>
      </article>
    </div>
  );
}
