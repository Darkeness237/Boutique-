"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// Favoris enregistrés dans le navigateur (comme le panier) : aucun compte nécessaire.
const KEY = "vetex.favoris.v1";
const MAX = 100;

type Ctx = { ids: string[]; ready: boolean; has: (id: string) => boolean; toggle: (id: string) => void };
const FavoritesContext = createContext<Ctx | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
      if (Array.isArray(raw)) setIds(raw.filter((x) => typeof x === "string" && /^\d{1,12}$/.test(x)).slice(0, MAX));
    } catch {
      // Stockage indisponible : favoris vides.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      // Stockage plein ou bloqué : on garde les favoris en mémoire.
    }
  }, [ids, ready]);

  const toggle = useCallback(
    (id: string) => setIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [id, ...list].slice(0, MAX))),
    [],
  );
  const value = useMemo(() => ({ ids, ready, has: (id: string) => ids.includes(id), toggle }), [ids, ready, toggle]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): Ctx {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites doit être utilisé dans FavoritesProvider");
  return ctx;
}

export function FavoriteButton({ id, name, large = false }: { id: string; name: string; large?: boolean }) {
  const { has, toggle, ready } = useFavorites();
  const on = ready && has(id);
  return (
    <button
      type="button"
      className={`fav-btn${large ? " fav-btn-lg" : ""}${on ? " is-on" : ""}`}
      aria-pressed={on}
      aria-label={on ? `Retirer ${name} des favoris` : `Ajouter ${name} aux favoris`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(id);
      }}
    >
      <svg viewBox="0 0 24 24" width={large ? 22 : 18} height={large ? 22 : 18} aria-hidden="true">
        <path
          d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.5 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.5 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"
          fill={on ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      {large && <span>{on ? "Dans vos favoris" : "Ajouter aux favoris"}</span>}
    </button>
  );
}

export function FavoritesLink() {
  const { ids, ready } = useFavorites();
  return (
    <a href="/favoris" className="header-link header-fav" aria-label={`Favoris (${ready ? ids.length : 0})`}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.5 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.5 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      {ready && ids.length > 0 && <span className="fav-count">{ids.length}</span>}
    </a>
  );
}
