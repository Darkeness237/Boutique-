import type { Metadata } from "next";
import Link from "next/link";
import { ClearCart } from "@/components/ClearCart";
import { formatMoney } from "@/lib/market";
import { orderSummary } from "@/lib/orders";

export const metadata: Metadata = { title: "Merci pour votre commande", robots: { index: false } };

type Props = { searchParams: Promise<{ session_id?: string | string[] }> };

export default async function ThankYouPage({ searchParams }: Props) {
  const raw = (await searchParams).session_id;
  const sessionId = typeof raw === "string" && /^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(raw) ? raw : null;
  const order = sessionId ? await orderSummary(sessionId).catch(() => null) : null;

  return (
    <div className="wrap">
      <div className="auth thanks">
        {sessionId && <ClearCart />}
        <h1>Merci pour votre commande</h1>
        {order ? (
          <>
            <p className="lede">
              Votre commande <strong>{order.number}</strong> est confirmée. Un reçu vous a été envoyé par e-mail.
            </p>
            <ul className="thanks-items">
              {(order.items ?? []).map((i) => (
                <li key={i.name}>
                  {i.qty} × {i.name}
                </li>
              ))}
            </ul>
            <p className="summary-row summary-total">
              <span>Total payé</span>
              <span>{formatMoney(order.currency === "xaf" ? "cm" : "fr", order.total)}</span>
            </p>
            <p className="lede">
              Nous préparons votre colis : vous recevrez le numéro de suivi par e-mail dès son expédition.
            </p>
          </>
        ) : (
          <p className="lede">
            {sessionId
              ? "Votre paiement est en cours de confirmation. Vous recevrez un e-mail dans quelques minutes avec le numéro de commande."
              : "Nous n'avons pas trouvé de commande à afficher."}
          </p>
        )}
        <Link href="/" className="btn btn-quiet">
          Retour à la boutique
        </Link>
      </div>
    </div>
  );
}
