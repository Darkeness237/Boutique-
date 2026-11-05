import type { Metadata } from "next";
import Link from "next/link";
import { FREE_SHIPPING_CENTS, SHIPPING_CENTS } from "@/lib/cart";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { PRICE_NOTE } from "@/lib/legal";

export const metadata: Metadata = { title: "Conditions générales de vente" };

const eur = (cents: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

// Trame reprenant les obligations du Code de la consommation pour une vente à distance dont les produits partent
// directement des entrepôts de nos fournisseurs. À faire relire par un juriste avant la mise en ligne.
export default function CgvPage() {
  const contact = SUPPORT_EMAIL ? <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> : <Link href="/aide">notre page d&apos;aide</Link>;
  return (
    <div className="wrap">
      <article className="prose">
        <h1>Conditions générales de vente</h1>
        <p>
          Version du 5 novembre 2026. Les présentes conditions s&apos;appliquent aux commandes passées sur le site Vetex PC
          par des consommateurs, pour une livraison en France métropolitaine (Corse comprise). Le vendeur est identifié dans
          les <Link href="/mentions-legales">mentions légales</Link>. Pour toute question : {contact}.
        </p>

        <h2>1. Produits et disponibilité</h2>
        <p>
          Les produits sont neufs, dans leur emballage d&apos;origine. Ils sont stockés et expédiés par nos partenaires
          logistiques (grossistes agréés par les fabricants), directement vers votre adresse. La disponibilité affichée est
          mise à jour plusieurs fois par jour. Si un produit commandé n&apos;est finalement plus disponible, nous vous
          prévenons sous 48 h ouvrées : vous choisissez alors entre un produit équivalent au même prix ou le remboursement
          intégral, effectué au plus tard 14 jours après le paiement.
        </p>

        <h2>2. Prix</h2>
        <p>
          Les prix sont indiqués en euros, toutes taxes comprises ({PRICE_NOTE}), éco-participation comprise. Les frais de
          livraison sont affichés avant le paiement : {eur(SHIPPING_CENTS)} par commande, offerts dès {eur(FREE_SHIPPING_CENTS)}{" "}
          d&apos;achat. Le prix applicable est celui affiché au moment de la commande.
        </p>

        <h2>3. Commande et paiement</h2>
        <p>
          La commande est conclue après le paiement, qui est débité immédiatement. Le paiement par carte est traité par
          Stripe : nous n&apos;avons jamais accès au numéro de votre carte. Un récapitulatif vous est envoyé par e-mail ; il
          vaut confirmation de commande.
        </p>

        <h2>4. Livraison</h2>
        <p>
          Les produits en stock sont expédiés sous 1 à 3 jours ouvrés, puis livrés en 24 à 72 h par transporteur (Colissimo,
          DPD, GLS ou équivalent), soit un délai total maximal de 7 jours ouvrés, sauf indication contraire sur la fiche
          produit. Une commande comprenant des produits de plusieurs entrepôts peut arriver en plusieurs colis, sans frais
          supplémentaires. Le numéro de suivi est disponible sur la page <Link href="/suivi">Suivre ma commande</Link> et
          dans votre compte.
        </p>
        <p>
          Vérifiez le colis devant le livreur. En cas d&apos;emballage abîmé ou de produit manquant, notez des réserves
          précises auprès du transporteur et prévenez-nous sous 3 jours ({contact}). Les risques vous sont transférés à la
          réception du colis (article L216-4 du Code de la consommation). Si la livraison dépasse le délai annoncé, vous
          pouvez nous demander de livrer dans un délai supplémentaire raisonnable, puis résoudre la commande à défaut
          (article L216-6).
        </p>

        <h2>5. Droit de rétractation (14 jours)</h2>
        <p>
          Vous disposez de 14 jours à compter de la réception du produit pour vous rétracter, sans avoir à vous justifier
          (articles L221-18 et suivants du Code de la consommation).
        </p>
        <ol>
          <li>
            Informez-nous de votre décision avant la fin du délai, par e-mail ({contact}) ou avec le formulaire ci-dessous,
            en indiquant votre numéro de commande.
          </li>
          <li>
            Nous vous communiquons sous 48 h ouvrées l&apos;adresse de retour : c&apos;est l&apos;entrepôt de notre partenaire
            qui a expédié le produit, et non notre siège. Un produit envoyé à une autre adresse ne peut pas être traité.
          </li>
          <li>
            Renvoyez le produit complet (accessoires, notices, emballage d&apos;origine si possible) au plus tard 14 jours
            après nous avoir informés. Les frais de retour sont à votre charge, sauf produit défectueux, non conforme ou
            erreur de notre part ; à titre indicatif, comptez de 8 à 15 € pour un colis de moins de 5 kg et de 15 à 40 € pour
            un boîtier PC ou un écran.
          </li>
          <li>
            Nous vous remboursons, frais de livraison initiaux compris (au tarif standard), au plus tard 14 jours après avoir
            été informés de votre rétractation. Nous pouvons attendre la réception du produit ou la preuve de son envoi. Le
            remboursement se fait sur la carte utilisée pour le paiement.
          </li>
        </ol>
        <p>
          Votre responsabilité peut être engagée en cas de dépréciation du produit résultant de manipulations autres que
          celles nécessaires pour en établir la nature, les caractéristiques et le bon fonctionnement (par exemple un
          produit monté, rayé ou incomplet). Ne bénéficient pas du droit de rétractation (article L221-28) : les logiciels
          et licences descellés ou activés, et les produits d&apos;hygiène descellés (écouteurs intra-auriculaires).
        </p>

        <h2>6. Garanties et service après-vente</h2>
        <div className="legal-box">
          <p>
            <strong>Garantie légale de conformité.</strong> Le consommateur dispose d&apos;un délai de deux ans à compter de
            la délivrance du bien pour obtenir la mise en œuvre de la garantie légale de conformité en cas d&apos;apparition
            d&apos;un défaut de conformité. Durant ce délai, le consommateur n&apos;est tenu d&apos;établir que
            l&apos;existence du défaut de conformité et non la date d&apos;apparition de celui-ci. La garantie légale de
            conformité emporte obligation de fournir toutes les mises à jour nécessaires au maintien de la conformité du
            bien. Elle donne au consommateur droit à la réparation ou au remplacement du bien dans un délai de trente jours
            suivant sa demande, sans frais et sans inconvénient majeur pour lui. Si le bien est réparé dans le cadre de la
            garantie légale de conformité, le consommateur bénéficie d&apos;une extension de six mois de la garantie
            initiale. Le consommateur peut obtenir une réduction du prix d&apos;achat en conservant le bien ou mettre fin
            au contrat en se faisant rembourser intégralement contre restitution du bien, si le vendeur refuse de réparer
            ou de remplacer le bien, si la réparation ou le remplacement n&apos;a pas lieu dans les trente jours, si la
            réparation ou le remplacement entraîne un inconvénient majeur, ou si la non-conformité persiste. Ces droits
            résultent des articles L217-1 à L217-32 du Code de la consommation.
          </p>
          <p>
            Le vendeur qui fait obstacle de mauvaise foi à la mise en œuvre de la garantie légale de conformité encourt une
            amende civile d&apos;un montant maximal de 300 000 euros, qui peut être porté jusqu&apos;à 10 % du chiffre
            d&apos;affaires moyen annuel (article L241-5).
          </p>
          <p>
            Le consommateur bénéficie également de la garantie légale des vices cachés en application des articles 1641 à
            1649 du Code civil, pendant une durée de deux ans à compter de la découverte du défaut. Cette garantie donne
            droit à une réduction de prix si le bien est conservé ou à un remboursement intégral contre restitution du bien.
          </p>
        </div>
        <p>
          <strong>Comment faire jouer la garantie.</strong> Contactez-nous ({contact}) avec votre numéro de commande, une
          description de la panne et, si possible, une photo ou une vidéo. Nous sommes votre seul interlocuteur : nous
          organisons le diagnostic et le retour avec notre partenaire ou le fabricant, et vous communiquons l&apos;adresse
          d&apos;envoi et une étiquette prépayée. Les frais de retour d&apos;un produit défectueux sont à notre charge. Un
          produit non réparable ni remplaçable sous 30 jours est remboursé.
        </p>
        <p>
          Certains fabricants offrent en plus une garantie commerciale (souvent 3 à 5 ans) : ses conditions figurent sur la
          fiche du produit ou dans sa notice. Elle s&apos;ajoute à la garantie légale sans la remplacer.
        </p>

        <h2>7. Reprise de vos anciens appareils</h2>
        <p>
          Pour tout achat d&apos;un équipement électrique ou électronique, nous reprenons gratuitement votre ancien appareil
          du même type (« un pour un »). Écrivez-nous ({contact}) dans les 30 jours suivant la livraison : nous vous indiquons
          la marche à suivre. Vous pouvez aussi déposer vos appareils usagés dans un point de collecte (déchetterie, magasin
          d&apos;électronique). Ne les jetez pas avec les ordures ménagères.
        </p>

        <h2>8. Médiation et litiges</h2>
        <p>
          En cas de difficulté, écrivez-nous d&apos;abord : nous répondons sous 72 h ouvrées. À défaut de solution amiable
          sous 30 jours, vous pouvez recourir gratuitement au médiateur de la consommation :{" "}
          <span className="todo">[nom, adresse et site du médiateur]</span>. Vous pouvez aussi utiliser la plateforme
          européenne de règlement en ligne des litiges. Le droit français est applicable.
        </p>

        <h2>9. Données personnelles</h2>
        <p>
          Vos données servent uniquement au traitement de votre commande et au service client. Voir notre{" "}
          <Link href="/confidentialite">politique de confidentialité</Link>.
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

        <h2 id="formulaire-retractation">Annexe : formulaire de rétractation</h2>
        <div className="legal-box">
          <p>
            À l&apos;attention de Vetex PC, {SUPPORT_EMAIL ?? "[adresse e-mail du service client]"} :
          </p>
          <p>
            Je vous notifie par la présente ma rétractation du contrat portant sur la vente du bien ci-dessous :
            <br />— Numéro de commande :
            <br />— Produit(s) :
            <br />— Commandé le / reçu le :
            <br />— Nom du consommateur :
            <br />— Adresse du consommateur :
            <br />— Date :
            <br />— Signature (uniquement en cas d&apos;envoi papier) :
          </p>
        </div>
      </article>
    </div>
  );
}
