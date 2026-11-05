#!/usr/bin/env node
// Récupère la galerie de photos officielles de chaque produit (Open Icecat) : vues de face, de dos, de détail,
// et l'emballage quand le fabricant l'a publié. 8 photos au maximum par produit, en 500 × 500.
//
//   node --env-file=.env.local --env-file=chemin/vers/import.env scripts/galerie-icecat.mjs [nombre]
//
// Chaque produit n'est interrogé qu'une fois (gallery_checked_at). Peu de requêtes en parallèle,
// pour respecter l'usage équitable du service.

const LIMIT = Number(process.argv[2] ?? 5000);
const CONCURRENCY = 4;
const MAX_IMAGES = 8;

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

async function gallery(ean) {
  const res = await fetch(`https://live.icecat.biz/api?UserName=openicecat-live&Language=fr&GTIN=${encodeURIComponent(ean)}`);
  if (res.status === 429) throw new Error("limite de requêtes atteinte");
  if (!res.ok) return [];
  const data = (await res.json()).data;
  const items = [...(data?.Gallery ?? [])]
    .filter((g) => g.IsPrivate !== "Y")
    .sort((a, b) => Number(a.No) - Number(b.No));
  const urls = [];
  for (const g of items) {
    const u = g.Pic500x500 || g.LowPic;
    if (u?.startsWith("https://images.icecat.biz/") && !urls.includes(u)) urls.push(u);
    if (urls.length >= MAX_IMAGES) break;
  }
  return urls;
}

const todo = (await rpc("gallery_todo", { p_limit: LIMIT })).map((r) => r.ean);
console.log(`${todo.length} produits à traiter.`);

let done = 0;
let withGallery = 0;
let photos = 0;
const buffer = [];
const flush = async () => buffer.length && (await rpc("import_gallery", { p_rows: buffer.splice(0) }));

const queue = [...todo];
let stop = false;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length && !stop) {
      const ean = queue.shift();
      let images;
      try {
        images = await gallery(ean);
      } catch (e) {
        if (String(e.message).includes("limite")) {
          stop = true; // On s'arrête proprement ; les produits restants seront repris au prochain passage.
          break;
        }
        images = [];
      }
      if (images.length > 1) withGallery++;
      photos += images.length;
      buffer.push({ ean, images });
      done++;
      if (buffer.length >= 200) await flush();
      if (done % 100 === 0) process.stdout.write(`\r${done}/${todo.length} traités, ${withGallery} galeries, ${photos} photos`);
    }
  }),
);
await flush();
console.log(`\nTerminé : ${done} produits, ${withGallery} avec plusieurs photos, ${photos} photos en tout.${stop ? " Arrêt anticipé (limite Icecat), relancer plus tard." : ""}`);
