"use client";

import { useState } from "react";
import { ProductVisual } from "./ProductVisual";

/** Photo fabricant si elle existe, sinon le schéma de la catégorie. */
export function ProductImage({
  src,
  alt,
  category,
  brand,
  priority,
}: {
  src: string | null;
  alt: string;
  category: string;
  brand?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className="visual-fallback">
        <ProductVisual category={category} />
        {brand && <span className="visual-brand">{brand}</span>}
      </span>
    );
  }
  return (
    // Images servies directement par le CDN du fabricant (pas d'optimiseur Next.js à configurer).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="product-photo"
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
