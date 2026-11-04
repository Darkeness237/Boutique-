import Link from "next/link";
import { displayName, type Category } from "@/lib/catalog";
import { checkBuild, estimatedWatts } from "@/lib/compat";
import type { Build } from "@/lib/configs";
import { formatMoney, unitPrice, type Market } from "@/lib/market";
import { AddBuildButton } from "./AddBuildButton";

/** Une config complète : pièces, contrôles de compatibilité calculés, total et ajout en un clic. */
export function ConfigCard({ build, categories, market }: { build: Build; categories: Category[]; market: Market }) {
  const { tier, parts } = build;
  const checks = checkBuild(parts);
  const total = parts.reduce((s, p) => s + unitPrice(p, market), 0);
  const allOk = checks.every((c) => c.ok);
  return (
    <section className="bench config-card" id={tier.slug} aria-labelledby={`${tier.slug}-t`}>
      <header className="bench-head">
        <h2 id={`${tier.slug}-t`}>{tier.title}</h2>
        <p>{estimatedWatts(parts)} W en charge</p>
      </header>
      <p className="config-pitch">{tier.pitch}</p>
      <ul className="config-usage">
        {tier.usage.map((u) => (
          <li key={u}>{u}</li>
        ))}
      </ul>
      <ol className="bench-parts">
        {parts.map((p) => (
          <li key={p.id}>
            <span className="bench-cat">{categories.find((c) => c.slug === p.category_slug)?.name}</span>
            <Link href={`/produit/${p.slug}`} className="bench-name">
              {p.brand} {displayName(p)}
            </Link>
            <span className="bench-price">{formatMoney(market, unitPrice(p, market))}</span>
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
          <span className="bench-total-label">PC complet</span>
          <span className="bench-total">{formatMoney(market, total)}</span>
        </p>
        <AddBuildButton ids={parts.map((p) => String(p.id))} disabled={!allOk} />
      </footer>
    </section>
  );
}
