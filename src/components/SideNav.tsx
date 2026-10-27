import Link from "next/link";
import type { CategoryNode } from "@/lib/catalog";

// Menu vertical des rayons : colonne de gauche de l'accueil et du catalogue.
// Le rayon courant est déplié et montre ses sous-catégories.
export function SideNav({
  tree,
  current,
  currentSub,
  title = "Rayons",
}: {
  tree: CategoryNode[];
  current?: string;
  currentSub?: string;
  title?: string;
}) {
  return (
    <nav className="sidenav" aria-label={title}>
      <p className="sidenav-title">{title}</p>
      <ul>
        {tree.map((c) => {
          const active = c.slug === current;
          return (
            <li key={c.slug}>
              <Link
                href={`/catalogue/${c.slug}`}
                className={`sidenav-link ${active && !currentSub ? "is-current" : ""}`}
                aria-current={active && !currentSub ? "page" : undefined}
              >
                {c.name}
              </Link>
              {active && c.subs.length > 0 && (
                <ul className="sidenav-subs">
                  {c.subs
                    .filter((s) => s.count > 0)
                    .map((s) => (
                      <li key={s.slug}>
                        <Link
                          href={`/catalogue/${c.slug}?sous=${s.slug}`}
                          className={`sidenav-link ${currentSub === s.slug ? "is-current" : ""}`}
                          aria-current={currentSub === s.slug ? "page" : undefined}
                        >
                          {s.name}
                          <span className="sidenav-count">{s.count}</span>
                        </Link>
                      </li>
                    ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
