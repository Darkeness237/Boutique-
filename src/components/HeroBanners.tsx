"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type Banner = {
  id: string;
  kicker: string;
  title: string;
  text: string;
  cta: string;
  href: string;
  image: string | null;
  tone: "violet" | "slate" | "ice";
};

const DELAY = 7000;

// Carrousel de bannières : défilement automatique toutes les 7 s, en pause au survol, au focus
// et quand l'utilisateur a demandé à réduire les animations. Flèches et puces pour naviguer.
export function HeroBanners({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useRef(false);
  const count = banners.length;

  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (paused || reduce.current || count < 2) return;
    const t = window.setTimeout(() => go(index + 1), DELAY);
    return () => window.clearTimeout(t);
  }, [index, paused, count, go]);

  if (!count) return null;

  return (
    <section
      className="banners"
      aria-roledescription="carrousel"
      aria-label="Offres à la une"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="banners-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {banners.map((b, i) => (
          <div
            key={b.id}
            className={`banner banner-${b.tone}`}
            role="group"
            aria-roledescription="bannière"
            aria-label={`${i + 1} sur ${count}`}
            aria-hidden={i !== index}
            inert={i !== index}
          >
            <div className="banner-copy">
              <p className="banner-kicker">{b.kicker}</p>
              <h2 className="banner-title">{b.title}</h2>
              <p className="banner-text">{b.text}</p>
              <Link href={b.href} className="btn btn-lg banner-cta">
                {b.cta}
              </Link>
            </div>
            {b.image && (
              <div className="banner-art" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.image} alt="" loading={i === 0 ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" />
              </div>
            )}
          </div>
        ))}
      </div>
      {count > 1 && (
        <>
          <button type="button" className="banners-arrow banners-prev" onClick={() => go(index - 1)} aria-label="Bannière précédente">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" className="banners-arrow banners-next" onClick={() => go(index + 1)} aria-label="Bannière suivante">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="banners-dots">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                className={i === index ? "is-on" : ""}
                aria-label={`Afficher la bannière ${i + 1}`}
                aria-current={i === index}
                onClick={() => go(i)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
