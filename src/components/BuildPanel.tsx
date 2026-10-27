import Link from "next/link";
import { getProductById, categories, type Product } from "@/lib/catalog";
import { checkBuild, estimatedWatts } from "@/lib/compat";
import { formatPrice } from "@/lib/format";
import { AddBuildButton } from "./AddBuildButton";

// Config d'exemple affichée à l'accueil. Les contrôles sont calculés, pas écrits à la main :
// changer une pièce ici met à jour les vérifications.
const BUILD_IDS = ["cpu-9800x3d", "mb-b850f", "ram-vengeance-32", "gpu-5070", "psu-rm850x"];

export function BuildPanel() {
  const parts = BUILD_IDS.map(getProductById).filter((p): p is Product => Boolean(p));
  const checks = checkBuild(parts);
  const total = parts.reduce((s, p) => s + p.priceCents, 0);
  const allOk = checks.every((c) => c.ok);

  return (
    <section className="bench" aria-labelledby="bench-title">
      <header className="bench-head">
        <h2 id="bench-title">Config 1440p, vérifiée</h2>
        <p>{estimatedWatts(parts)} W en charge</p>
      </header>
      <ol className="bench-parts">
        {parts.map((p) => (
          <li key={p.id}>
            <span className="bench-cat">{categories.find((c) => c.slug === p.category)?.name}</span>
            <Link href={`/produit/${p.slug}`} className="bench-name">
              {p.brand} {p.name}
            </Link>
            <span className="bench-price">{formatPrice(p.priceCents)}</span>
          </li>
        ))}
      </ol>
      <ul className="bench-checks" aria-label="Vérifications de compatibilité">
        {checks.map((c) => (
          <li key={c.label} className={c.ok ? "is-ok" : "is-ko"}>
            <span className="bench-dot" aria-hidden="true" />
            <span className="bench-check-label">{c.label}</span>
            <span className="bench-check-detail">
              {c.ok ? "" : "Incompatible : "}
              {c.detail}
            </span>
          </li>
        ))}
      </ul>
      <footer className="bench-foot">
        <p>
          <span className="bench-total-label">Total</span>
          <span className="bench-total">{formatPrice(total)}</span>
        </p>
        <AddBuildButton ids={parts.map((p) => p.id)} disabled={!allOk} />
      </footer>
    </section>
  );
}
