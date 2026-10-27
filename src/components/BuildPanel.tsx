import Link from "next/link";
import { displayName, getCategories } from "@/lib/catalog";
import { pickBuild } from "@/lib/build";
import { checkBuild, estimatedWatts } from "@/lib/compat";
import { formatPrice } from "@/lib/format";
import { AddBuildButton } from "./AddBuildButton";

// Config composée à partir du stock réel ; les contrôles sont calculés, pas écrits à la main.
export async function BuildPanel() {
  const [parts, categories] = await Promise.all([pickBuild(), getCategories()]);
  if (!parts) return null;

  const checks = checkBuild(parts);
  const total = parts.reduce((s, p) => s + p.price_cents, 0);
  const allOk = checks.every((c) => c.ok);

  return (
    <section className="bench" aria-labelledby="bench-title">
      <header className="bench-head">
        <h2 id="bench-title">Config du moment, vérifiée</h2>
        <p>{estimatedWatts(parts)} W en charge</p>
      </header>
      <ol className="bench-parts">
        {parts.map((p) => (
          <li key={p.id}>
            <span className="bench-cat">{categories.find((c) => c.slug === p.category_slug)?.name}</span>
            <Link href={`/produit/${p.slug}`} className="bench-name">
              {p.brand} {displayName(p)}
            </Link>
            <span className="bench-price">{formatPrice(p.price_cents)}</span>
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
        <AddBuildButton ids={parts.map((p) => String(p.id))} disabled={!allOk} />
      </footer>
    </section>
  );
}
