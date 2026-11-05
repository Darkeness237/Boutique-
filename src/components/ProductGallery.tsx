"use client";

import { useState } from "react";

/**
 * Galerie de la fiche produit : grande photo et vignettes. Sans photo, affiche le visuel de remplacement.
 * Les flèches du clavier passent d'une photo à l'autre quand une vignette a le focus.
 */
export function ProductGallery({
  photos,
  alt,
  flag,
  fallback,
}: {
  photos: string[];
  alt: string;
  flag?: React.ReactNode;
  fallback: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState<string[]>([]);
  const list = photos.filter((p) => !broken.includes(p));
  const current = list[Math.min(index, list.length - 1)];
  const go = (i: number) => setIndex((i + list.length) % list.length);

  return (
    <>
      <div className="product-hero-visual">
        {flag}
        {current ? (
          // Images servies par le CDN du fabricant (pas d'optimiseur Next.js à configurer).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current}
            src={current}
            alt={list.length > 1 ? `${alt}, photo ${index + 1} sur ${list.length}` : alt}
            className="product-photo"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setBroken((b) => [...b, current])}
          />
        ) : (
          fallback
        )}
        {list.length > 1 && (
          <>
            <button type="button" className="gallery-arrow gallery-prev" aria-label="Photo précédente" onClick={() => go(index - 1)}>
              ‹
            </button>
            <button type="button" className="gallery-arrow gallery-next" aria-label="Photo suivante" onClick={() => go(index + 1)}>
              ›
            </button>
            <span className="gallery-count" aria-hidden="true">
              {index + 1} / {list.length}
            </span>
          </>
        )}
      </div>
      {list.length > 1 && (
        <ul className="gallery-thumbs" aria-label="Photos du produit">
          {list.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                className={i === index ? "is-on" : undefined}
                aria-label={`Voir la photo ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length;
                    setIndex(next);
                    (e.currentTarget.parentElement?.parentElement?.children[next]?.firstElementChild as HTMLElement | null)?.focus();
                  }
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken((b) => [...b, src])} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
