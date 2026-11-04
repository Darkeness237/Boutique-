"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AddBuildButton } from "@/components/AddBuildButton";
import { useMarket } from "@/components/MarketProvider";
import { ProductImage } from "@/components/ProductImage";
import { checkBuild, estimatedWatts, recommendedPsuWatts } from "@/lib/compat";
import { NO_IGPU, STEPS, type Step, type StepKey } from "@/lib/configurator";
import { formatMoney, unitPrice } from "@/lib/market";
import { displayName, type Product } from "@/lib/product";
import type { View } from "./Scene3D";

const Scene3D = dynamic(() => import("./Scene3D"), {
  ssr: false,
  loading: () => <div className="scene3d scene3d-loading">Chargement de la vue 3D…</div>,
});

type Parts = Partial<Record<StepKey, Product>>;

const SUB_LABELS: Record<string, string> = {
  "ssd-nvme": "SSD NVMe",
  "ssd-sata": "SSD SATA",
  "disques-durs": "Disques durs",
  ventirads: "Ventirads",
  watercooling: "Watercooling",
  "moyen-tour": "Moyen tour",
  "mini-tour": "Mini tour",
  "grand-tour": "Grand tour",
  "27-et-plus": "27 pouces et plus",
  "moins-27": "Moins de 27 pouces",
  incurves: "Incurvés",
};

/** Une étape est-elle obligatoire avec les pièces déjà choisies ? */
function isRequired(step: Step, parts: Parts): boolean {
  if (step.key === "gpu") return !!parts.cpu && NO_IGPU.test(parts.cpu.name);
  return !step.optional;
}

/** Ce qui manque avant de pouvoir choisir cette pièce (null : l'étape est ouverte). */
function blockedBy(step: StepKey, parts: Parts): string | null {
  if (step === "board" && !parts.cpu) return "Choisissez d'abord le processeur.";
  if (step === "ram" && !parts.board) return "Choisissez d'abord la carte mère.";
  return null;
}

function queryFor(step: Step, parts: Parts, sub: string | null): string {
  const q = new URLSearchParams({ etape: step.key });
  if (step.key === "board" && parts.cpu?.socket) q.set("socket", parts.cpu.socket);
  if (step.key === "ram" && parts.board?.memory) q.set("memoire", parts.board.memory);
  if (step.key === "psu") {
    const core = [parts.cpu, parts.gpu].filter((p): p is Product => !!p);
    q.set("watts", String(Math.max(400, recommendedPsuWatts(core))));
  }
  if (sub) q.set("sous", sub);
  return q.toString();
}

/** Retire les pièces devenues incompatibles après un changement en amont. */
function prune(parts: Parts): Parts {
  const next = { ...parts };
  if (next.board && next.cpu?.socket && next.board.socket && next.board.socket !== next.cpu.socket) delete next.board;
  if (!next.cpu) delete next.board;
  if (next.ram && (!next.board || (next.board.memory && next.ram.memory && next.ram.memory !== next.board.memory))) delete next.ram;
  if (next.psu?.psu_watts) {
    const core = [next.cpu, next.gpu].filter((p): p is Product => !!p);
    if (next.psu.psu_watts < recommendedPsuWatts(core)) delete next.psu;
  }
  return next;
}

export function Configurator() {
  const market = useMarket();
  const [parts, setParts] = useState<Parts>({});
  const [index, setIndex] = useState(0);
  const [view, setView] = useState<View>("pc");
  const [sub, setSub] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [options, setOptions] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef(new Map<string, Product[]>());
  const listRef = useRef<HTMLDivElement>(null);

  const step = STEPS[index];
  const blocked = blockedBy(step.key, parts);
  const query = queryFor(step, parts, sub);

  useEffect(() => {
    if (blocked) return;
    const hit = cache.current.get(query);
    if (hit) {
      setOptions(hit);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setOptions(null);
    setError(null);
    fetch(`/api/configurateur?${query}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error ?? "Erreur");
        cache.current.set(query, body);
        setOptions(body);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError("Impossible de charger les pièces. Réessayez dans un instant.");
      });
    return () => ctrl.abort();
  }, [query, blocked]);

  function goTo(i: number) {
    setIndex(i);
    setSub(null);
    setFilter("");
    // La vue suit la phase : intérieur du PC pour les composants, bureau pour le setup.
    setView(STEPS[i].phase === "setup" ? "desk" : "pc");
    listRef.current?.scrollTo({ top: 0 });
  }

  function choose(p: Product) {
    setParts((prev) => prune({ ...prev, [step.key]: p }));
    if (index < STEPS.length - 1) goTo(index + 1);
  }

  function remove(key: StepKey) {
    setParts((prev) => {
      const next = { ...prev };
      delete next[key];
      return prune(next);
    });
  }

  const chosen = STEPS.map((s) => parts[s.key]).filter((p): p is Product => !!p);
  const pcParts = STEPS.filter((s) => s.phase === "pc").map((s) => parts[s.key]).filter((p): p is Product => !!p);
  const checks = checkBuild(chosen);
  const total = chosen.reduce((sum, p) => sum + unitPrice(p, market), 0);
  const missing = STEPS.filter((s) => s.phase === "pc" && isRequired(s, parts) && !parts[s.key]);
  const ready = missing.length === 0 && checks.every((c) => c.ok);

  const shown = useMemo(() => {
    const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
    if (!options || words.length === 0) return options;
    return options.filter((p) => {
      const hay = `${p.brand} ${p.name}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [options, filter]);

  const required = isRequired(step, parts);

  return (
    <div className="configurator">
      <div className="cfg-stage">
        <div className="cfg-view-toggle segmented" role="radiogroup" aria-label="Vue 3D">
          {(
            [
              ["pc", "Intérieur du PC"],
              ["desk", "Setup bureau"],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className={view === v ? "is-on" : undefined}>
              <input type="radio" name="cfg-view" value={v} checked={view === v} onChange={() => setView(v)} />
              {label}
            </label>
          ))}
        </div>
        <Scene3D parts={parts} view={view} />
        <p className="cfg-stage-hint field-hint">
          Faites glisser pour tourner, molette ou pincement pour zoomer. Les pièces en pointillés restent à choisir.
        </p>
      </div>

      <div className="cfg-panel">
        <nav aria-label="Étapes de la configuration">
          <ol className="cfg-steps">
            {STEPS.map((s, i) => {
              const p = parts[s.key];
              const state = p ? "is-done" : i === index ? "is-current" : "";
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    className={`cfg-step ${state}`}
                    aria-current={i === index ? "step" : undefined}
                    onClick={() => goTo(i)}
                  >
                    <span className="cfg-step-num" aria-hidden="true">
                      {p ? "✓" : i + 1}
                    </span>
                    <span className="cfg-step-label">{s.label}</span>
                  </button>
                  {i === 7 && <span className="cfg-steps-sep" aria-hidden="true" />}
                </li>
              );
            })}
          </ol>
        </nav>

        <section className="cfg-choose" aria-labelledby="cfg-step-title">
          <header className="cfg-choose-head">
            <p className="cfg-phase">
              {step.phase === "pc" ? "Le PC" : "Le setup"} · étape {index + 1} sur {STEPS.length}
            </p>
            <h2 id="cfg-step-title">
              {step.label} {!required && <span className="cfg-optional">facultatif</span>}
            </h2>
            <p className="field-hint">
              {step.key === "gpu" && parts.cpu
                ? required
                  ? "Votre processeur n'a pas de puce graphique : une carte graphique est indispensable."
                  : "Votre processeur affiche l'image seul : la carte graphique sert pour jouer ou créer."
                : step.key === "psu" && parts.cpu
                  ? `Au moins ${Math.max(400, recommendedPsuWatts([parts.cpu, parts.gpu].filter((p): p is Product => !!p)))} W pour votre config (${estimatedWatts(pcParts)} W estimés en charge, avec marge).`
                  : step.hint}
            </p>
          </header>

          {blocked ? (
            <p className="cfg-blocked">
              {blocked}{" "}
              <button type="button" className="link-button" onClick={() => goTo(step.key === "ram" && !parts.cpu ? 0 : index - 1)}>
                Y aller
              </button>
            </p>
          ) : (
            <>
              <div className="cfg-tools">
                {step.subcategories && (
                  <div className="cfg-subs" role="group" aria-label="Type">
                    <button type="button" className={sub === null ? "chip is-on" : "chip"} onClick={() => setSub(null)}>
                      Tout
                    </button>
                    {step.subcategories.map((s) => (
                      <button key={s} type="button" className={sub === s ? "chip is-on" : "chip"} onClick={() => setSub(s)}>
                        {SUB_LABELS[s] ?? s}
                      </button>
                    ))}
                  </div>
                )}
                <label className="visually-hidden" htmlFor="cfg-filter">
                  Filtrer les {step.label.toLowerCase()}
                </label>
                <input
                  id="cfg-filter"
                  type="search"
                  className="cfg-filter"
                  placeholder="Filtrer (marque, modèle…)"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>

              <div className="cfg-options" ref={listRef} aria-busy={options === null && !error}>
                {error ? (
                  <p className="field-error">{error}</p>
                ) : shown === null ? (
                  <p className="field-hint">Recherche des pièces compatibles en stock…</p>
                ) : shown.length === 0 ? (
                  <p className="field-hint">Aucune pièce compatible en stock pour le moment.</p>
                ) : (
                  <ul>
                    {shown.map((p) => {
                      const on = parts[step.key]?.id === p.id;
                      return (
                        <li key={p.id}>
                          <button type="button" className={`cfg-option${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => choose(p)}>
                            <span className="cfg-option-img">
                              <ProductImage src={p.image_url} alt="" category={p.category_slug} />
                            </span>
                            <span className="cfg-option-text">
                              <span className="cfg-option-name">
                                {p.brand} {displayName(p)}
                              </span>
                              <span className="cfg-option-meta">
                                {[p.socket, p.memory, p.psu_watts ? `${p.psu_watts} W` : null].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                            <span className="cfg-option-price">{formatMoney(market, unitPrice(p, market))}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}

          <div className="cfg-nav">
            <button type="button" className="btn btn-quiet" disabled={index === 0} onClick={() => goTo(index - 1)}>
              Précédent
            </button>
            {index < STEPS.length - 1 && (
              <button type="button" className="btn btn-quiet" onClick={() => goTo(index + 1)}>
                {parts[step.key] ? "Suivant" : required ? "Passer pour l'instant" : "Passer"}
              </button>
            )}
          </div>
        </section>

        <section className="bench cfg-summary" aria-labelledby="cfg-summary-title">
          <header className="bench-head">
            <h2 id="cfg-summary-title">Votre configuration</h2>
            {pcParts.length > 0 && <p>{estimatedWatts(pcParts)} W en charge</p>}
          </header>
          {chosen.length === 0 ? (
            <p className="field-hint">Commencez par le processeur : le reste s&apos;adapte à votre choix.</p>
          ) : (
            <ol className="bench-parts">
              {STEPS.filter((s) => parts[s.key]).map((s) => {
                const p = parts[s.key]!;
                return (
                  <li key={s.key}>
                    <span className="bench-cat">{s.label}</span>
                    <Link href={`/produit/${p.slug}`} className="bench-name" target="_blank">
                      {p.brand} {displayName(p)}
                    </Link>
                    <span className="bench-price">
                      {formatMoney(market, unitPrice(p, market))}
                      <button type="button" className="cfg-remove" aria-label={`Retirer ${s.label.toLowerCase()}`} onClick={() => remove(s.key)}>
                        ×
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          {checks.length > 0 && (
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
          )}
          {missing.length > 0 && chosen.length > 0 && (
            <p className="field-hint">Il manque : {missing.map((s) => s.label.toLowerCase()).join(", ")}.</p>
          )}
          <footer className="bench-foot">
            <p>
              <span className="bench-total-label">Total</span>
              <span className="bench-total">{formatMoney(market, total)}</span>
            </p>
            {chosen.length > 0 && <AddBuildButton ids={chosen.map((p) => String(p.id))} disabled={!ready} />}
          </footer>
        </section>
      </div>
    </div>
  );
}
