"use client";

import { useRef } from "react";

// Carrousel horizontal : défilement natif (doigt, molette, clavier) avec aimantation,
// et deux boutons pour la souris.
export function ProductRail({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
  };
  return (
    <div className="rail">
      <div className="rail-controls">
        <button type="button" className="rail-btn" onClick={() => scroll(-1)} aria-label={`${label} : précédents`}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" className="rail-btn" onClick={() => scroll(1)} aria-label={`${label} : suivants`}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="rail-track" ref={ref} role="region" aria-label={label} tabIndex={0}>
        {children}
      </div>
    </div>
  );
}
