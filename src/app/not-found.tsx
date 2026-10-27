import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap section">
      <div className="empty">
        <h1>Cette page n&apos;existe pas</h1>
        <p>Le produit a peut-être été retiré du catalogue, ou l&apos;adresse contient une faute de frappe.</p>
        <Link href="/catalogue" className="btn btn-primary">
          Parcourir le catalogue
        </Link>
      </div>
    </div>
  );
}
