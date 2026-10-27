"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CategoryNode } from "@/lib/catalog";

// Menu latéral « Toutes les catégories » : un tiroir qui glisse depuis la gauche,
// avec les sous-catégories en accordéon. Échap ou un clic à côté le ferment.
export function CategoryDrawer({ tree }: { tree: CategoryNode[] }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Toute navigation referme le menu.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      (previous ?? openerRef.current)?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        className="drawer-opener"
        aria-expanded={open}
        aria-controls="menu-categories"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span>Toutes les catégories</span>
      </button>

      <div className={`drawer ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <div className="drawer-backdrop" onClick={() => setOpen(false)} />
        <div
          ref={panelRef}
          id="menu-categories"
          className="drawer-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Toutes les catégories"
          inert={!open}
        >
          <div className="drawer-head">
            <p>Toutes les catégories</p>
            <button type="button" className="drawer-close" onClick={() => setOpen(false)} aria-label="Fermer le menu">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <nav aria-label="Catégories">
            <ul className="drawer-list">
              <li>
                <Link href="/catalogue?promo=1" className="drawer-link drawer-deal">
                  Offres du moment
                </Link>
              </li>
              {tree.map((c) => {
                const isOpen = expanded === c.slug;
                return (
                  <li key={c.slug}>
                    {c.subs.length > 0 ? (
                      <>
                        <button
                          type="button"
                          className="drawer-link"
                          aria-expanded={isOpen}
                          onClick={() => setExpanded(isOpen ? null : c.slug)}
                        >
                          <span>{c.name}</span>
                          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="drawer-chevron">
                            <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        </button>
                        {isOpen && (
                          <ul className="drawer-subs">
                            <li>
                              <Link href={`/catalogue/${c.slug}`}>Tout le rayon {c.name.toLowerCase()}</Link>
                            </li>
                            {c.subs
                              .filter((s) => s.count > 0)
                              .map((s) => (
                                <li key={s.slug}>
                                  <Link href={`/catalogue/${c.slug}?sous=${s.slug}`}>
                                    {s.name}
                                    <span className="drawer-count">{s.count}</span>
                                  </Link>
                                </li>
                              ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <Link href={`/catalogue/${c.slug}`} className="drawer-link">
                        <span>{c.name}</span>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
}
