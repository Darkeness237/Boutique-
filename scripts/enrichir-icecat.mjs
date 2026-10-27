#!/usr/bin/env node
// Ajoute photos et caractéristiques aux produits, à partir de leur code EAN, via Open Icecat
// (contenu publié par les fabricants pour les revendeurs, licence Open Content).
//
//   node --env-file=.env.local --env-file=chemin/vers/import.env scripts/enrichir-icecat.mjs [nombre]
//
// Chaque produit n'est interrogé qu'une fois (media_checked_at). Requêtes limitées
// à quelques-unes en parallèle pour respecter l'usage équitable du service.

const LIMIT = Number(process.argv[2] ?? 1000);
const CONCURRENCY = 4;
const MAX_SPECS = 24;

const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key, IMPORT_TOKEN: token } = process.env;
if (!url || !key || !token) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY et IMPORT_TOKEN sont requis.");
  process.exit(1);
}

async function rpc(fn, args) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, ...args }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${fn} : HTTP ${res.status} ${body.slice(0, 200)}`);
  return JSON.parse(body);
}

const clip = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

async function lookup(ean) {
  const res = await fetch(
    `https://live.icecat.biz/api?UserName=openicecat-live&Language=fr&GTIN=${encodeURIComponent(ean)}`,
  );
  if (!res.ok) return { ean, image_url: null, specs: null };
  const data = (await res.json()).data;
  if (!data) return { ean, image_url: null, specs: null };

  // 500 × 500 (environ 60 Ko) : la photo HD pèse souvent plus de 2 Mo, trop lourd pour un catalogue.
  const image = data.Image?.Pic500x500 || data.Image?.LowPic || null;
  const specs = [];
  for (const group of data.FeaturesGroups ?? []) {
    for (const f of group.Features ?? []) {
      const label = clip(f.Feature?.Name?.Value, 80);
      const value = clip(f.PresentationValue, 120);
      if (label && value && specs.length < MAX_SPECS) specs.push([label, value]);
    }
  }
  return { ean, image_url: image?.startsWith("https://") ? image : null, specs: specs.length ? specs : null };
}

const todo = (await rpc("media_todo", { p_limit: LIMIT })).map((r) => r.ean);
console.log(`${todo.length} produits à enrichir.`);

let found = 0;
let done = 0;
const buffer = [];

async function flush() {
  if (buffer.length) await rpc("import_media", { p_rows: buffer.splice(0) });
}

const queue = [...todo];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const ean = queue.shift();
      let row;
      try {
        row = await lookup(ean);
      } catch {
        row = { ean, image_url: null, specs: null };
      }
      if (row.image_url) found++;
      buffer.push(row);
      done++;
      if (buffer.length >= 200) await flush();
      if (done % 100 === 0) process.stdout.write(`\r${done}/${todo.length} traités, ${found} photos`);
    }
  }),
);
await flush();
console.log(`\r${done}/${todo.length} traités, ${found} photos trouvées.`);
