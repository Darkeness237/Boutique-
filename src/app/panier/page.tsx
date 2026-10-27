import type { Metadata } from "next";
import { CartView } from "@/components/CartView";
import { getDeliveryZones } from "@/lib/catalog";

export const metadata: Metadata = { title: "Panier", robots: { index: false } };

export default async function CartPage() {
  const zones = await getDeliveryZones();
  return (
    <>
      <div className="wrap page-head">
        <h1>Panier</h1>
      </div>
      <div className="wrap">
        <CartView zones={zones} />
      </div>
    </>
  );
}
