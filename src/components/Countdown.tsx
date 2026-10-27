"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60) };
}

// Temps restant jusqu'à la vraie fin d'une offre. Mis à jour chaque minute (pas besoin de plus).
export function Countdown({ endsAt, prefix = "Se termine dans" }: { endsAt: string; prefix?: string }) {
  const end = Date.parse(endsAt);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  if (now === null) return null; // Rien au rendu serveur : évite un écart d'affichage à l'hydratation.
  if (end <= now) return <span className="countdown">Offre terminée</span>;
  const { d, h, m } = parts(end - now);
  return (
    <span className="countdown">
      {prefix} {d > 0 && `${d} j `}
      {h} h {d === 0 && `${m} min`}
    </span>
  );
}
