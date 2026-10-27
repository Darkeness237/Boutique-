import type { Metadata } from "next";
import { CartView } from "@/components/CartView";

export const metadata: Metadata = { title: "Panier", robots: { index: false } };

export default function CartPage() {
  return (
    <>
      <div className="wrap page-head">
        <h1>Panier</h1>
      </div>
      <div className="wrap">
        <CartView />
      </div>
    </>
  );
}
