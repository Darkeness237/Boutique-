#!/usr/bin/env node
// Importe un fichier tarif fournisseur dans Supabase.
//
//   node --env-file=.env.local --env-file=chemin/vers/import.env scripts/import-fournisseur.mjs 1fotrade fichier.csv
//
// import.env contient IMPORT_TOKEN. Gardez-le hors du dossier du projet : il ne doit ni partir
// sur GitHub ni être embarqué dans le site déployé.
//
// Le script ne fait que lire le fichier et l'envoyer par lots à l'API d'import de la base,
// protégée par IMPORT_TOKEN. La base calcule ensuite la meilleure offre et le prix de vente.

import { readFileSync } from "node:fs";

const SUPPLIERS = {
  // Format du fichier « 1fotrade_price.csv » : séparateur « ; », prix HT avec un point.
  // Encodage : UTF-8 (flux EDI) ou Latin-1 (export manuel), détecté automatiquement.
  "1fotrade": {
    separator: ";",
    columns: { sku: "SKU", ean: "EAN", mpn: "reference", family: "Famille", name: "nom", cost: "votre prix", stock: "stock", brand: "marque" },
    inStock: (v) => v.trim().toLowerCase() === "oui",
    families: [
      "Processeur", "Carte Mère", "Carte Graphique", "Mémoire RAM", "Stockage", "Alimentation PC", "Boîtier PC",
      "Watercooling", "Ventilateur pour Processeur", "Ventilateur de Boîtier", "Autres Eléments de Refroidissement",
      "Écran", "Souris", "Clavier", "Casque", "Tapis de Souris", "Pack Clavier - Souris", "Périphérique de Jeu", "Fauteuil",
    ],
  },
};

const BATCH = 1000;

function fail(message) {
  console.error(`Erreur : ${message}`);
  process.exit(1);
}

const [supplierId, file] = process.argv.slice(2);
const config = SUPPLIERS[supplierId];
if (!config || !file) fail(`usage : import-fournisseur.mjs <${Object.keys(SUPPLIERS).join("|")}> <fichier.csv>`);

const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key, IMPORT_TOKEN: token } = process.env;
if (!url || !key || !token) fail("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local) et IMPORT_TOKEN (import.env) sont requis.");

// Lecture CSV ------------------------------------------------------------------
function parseCsv(text, sep) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function decode(buf) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^\uFEFF/, "");
  } catch {
    return buf.toString("latin1");
  }
}

const raw = parseCsv(decode(readFileSync(file)), config.separator);
const header = raw[0].map((h) => h.trim());
const col = Object.fromEntries(
  Object.entries(config.columns).map(([k, name]) => {
    const i = header.indexOf(name);
    if (i < 0) fail(`colonne « ${name} » absente du fichier`);
    return [k, i];
  }),
);

const families = new Set(config.families);
const clip = (s, n) => s.trim().slice(0, n);
let skipped = 0;

const offers = [];
for (const r of raw.slice(1)) {
  const family = clip(r[col.family] ?? "", 128);
  if (!families.has(family)) continue;
  const cost = Number.parseFloat((r[col.cost] ?? "").replace(",", "."));
  const sku = clip(r[col.sku] ?? "", 64);
  const name = clip(r[col.name] ?? "", 300);
  if (!sku || !name || !Number.isFinite(cost) || cost <= 0 || cost > 100000) { skipped++; continue; }
  const ean = (r[col.ean] ?? "").trim();
  offers.push({
    sku,
    ean: /^[0-9]{8,14}$/.test(ean) ? ean : "",
    mpn: clip(r[col.mpn] ?? "", 128),
    family,
    name,
    brand: clip(r[col.brand] ?? "", 80),
    cost_cents: Math.round(cost * 100),
    in_stock: config.inStock(r[col.stock] ?? ""),
    quarantine_reason: null,
  });
}

// Garde-fou prix : un produit beaucoup moins cher que les autres versions du même modèle
// est presque toujours une erreur de saisie. On le bloque au lieu de le vendre à perte.
// Limité aux processeurs et cartes graphiques : ailleurs, « RTX 3080 » désigne un accessoire compatible.
const MODEL_FAMILIES = new Set(["Carte Graphique", "Processeur"]);
function modelKey(o) {
  if (!MODEL_FAMILIES.has(o.family)) return null;
  const m =
    o.name.match(/\b(RTX \d{4}(?: Ti)?(?: SUPER)?|RX \d{4}(?: XT| XTX| GRE)?|Arc [AB]\d{3})\b/i) ??
    o.name.match(/\b(Ryzen [3579] \d{4}X?3?D?|Core (?:Ultra )?[3579] \d{3,5}[A-Z]*)\b/i);
  return m ? `${o.family}|${m[1].toUpperCase()}` : null;
}
const groups = new Map();
for (const o of offers) {
  const k = modelKey(o);
  if (k) groups.set(k, [...(groups.get(k) ?? []), o]);
}
for (const [k, list] of groups) {
  if (list.length < 3) continue;
  const sorted = list.map((o) => o.cost_cents).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  for (const o of list) {
    if (o.cost_cents < median * 0.5) {
      o.quarantine_reason = `prix ${(o.cost_cents / 100).toFixed(2)} € < 50 % de la médiane ${(median / 100).toFixed(2)} € (${k.split("|")[1]})`;
    }
  }
}

// Envoi ------------------------------------------------------------------------
async function rpc(fn, args) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, ...args }),
  });
  const body = await res.text();
  if (!res.ok) fail(`${fn} : HTTP ${res.status} ${body.slice(0, 300)}`);
  return JSON.parse(body);
}

const quarantined = offers.filter((o) => o.quarantine_reason);
console.log(`${offers.length} offres retenues (${skipped} lignes invalides ignorées), ${quarantined.length} bloquées par le garde-fou prix.`);
for (const o of quarantined) console.log(`  quarantaine : ${o.sku} ${o.name.slice(0, 70)} — ${o.quarantine_reason}`);

const runId = await rpc("import_start", { p_supplier_id: supplierId });
for (let i = 0; i < offers.length; i += BATCH) {
  const n = await rpc("import_offers", { p_run_id: runId, p_rows: offers.slice(i, i + BATCH) });
  process.stdout.write(`\r${Math.min(i + BATCH, offers.length)}/${offers.length} envoyées (${n} dans ce lot)`);
}
console.log();
const result = await rpc("import_finish", { p_run_id: runId });
console.log("Terminé :", result);
