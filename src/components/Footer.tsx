import Link from "next/link";
import { FREE_SHIPPING_CENTS } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { PRICE_NOTE } from "@/lib/legal";
import { priceNote } from "@/lib/market";
import { getMarket } from "@/lib/market-server";
import { Logo } from "./Logo";

export async function Footer() {
  const market = await getMarket();
  return (
    <footer className="site-footer">
      <div className="wrap">
        {market === "cm" ? (
          <ul className="promises">
            <li>
              <strong>Douane comprise</strong>
              <span>Transport aérien, dédouanement et TVA camerounaise inclus dans le prix : aucune taxe à payer à l&apos;arrivée.</span>
            </li>
            <li>
              <strong>Livré à domicile</strong>
              <span>À Douala et Yaoundé, par notre partenaire local. De 2 000 à 3 500 FCFA par colis selon le poids, affiché au panier.</span>
            </li>
            <li>
              <strong>Garantie de 2 ans</strong>
              <span>En cas de panne, nous organisons le retour et l&apos;échange avec le fabricant.</span>
            </li>
            <li>
              <strong>Mobile Money</strong>
              <span>Paiement par Orange Money ou MTN MoMo, sur une page sécurisée.</span>
            </li>
          </ul>
        ) : (
          <ul className="promises">
            <li>
              <strong>Livraison offerte dès {formatPrice(FREE_SHIPPING_CENTS)}</strong>
              <span>Colissimo ou point relais, expédition sous 24 h ouvrées.</span>
            </li>
            <li>
              <strong>14 jours pour changer d&apos;avis</strong>
              <span>Retour gratuit d&apos;un produit non utilisé, remboursé sous 14 jours.</span>
            </li>
            <li>
              <strong>Garantie légale de 2 ans</strong>
              <span>En cas de panne, nous gérons l&apos;échange avec le fabricant.</span>
            </li>
            <li>
              <strong>Paiement sécurisé</strong>
              <span>Votre carte est saisie chez Stripe : nous ne voyons jamais son numéro.</span>
            </li>
          </ul>
        )}
        <div className="footer-bottom">
          <Logo />
          <nav aria-label="Informations légales">
            <ul>
              <li>
                <Link href="/mentions-legales">Mentions légales</Link>
              </li>
              <li>
                <Link href="/cgv">Conditions générales de vente</Link>
              </li>
              <li>
                <Link href="/confidentialite">Confidentialité et données personnelles</Link>
              </li>
            </ul>
          </nav>
          <p className="footer-copy">
            © {new Date().getFullYear()} Silicium · {priceNote(market, PRICE_NOTE)}
          </p>
          <p className="footer-copy footer-credit">
            Photos et caractéristiques produits : fabricants, via Open Icecat. Contenu fourni en l&apos;état.
          </p>
        </div>
      </div>
    </footer>
  );
}
