import type { Metadata } from "next";
import { CartView } from "@/components/CartView";
import { getDeliveryZones, getLastmileRates } from "@/lib/catalog";

export const metadata: Metadata = { title: "Panier", robots: { index: false } };

export default async function CartPage() {
  const [zones, rates] = await Promise.all([getDeliveryZones(), getLastmileRates()]);
  return (
    <>
      <div className="wrap page-head">
        <h1>Panier</h1>
      </div>
      <div className="wrap">
        <CartView zones={zones} rates={rates} />
      </div>
    </>
  );
}
