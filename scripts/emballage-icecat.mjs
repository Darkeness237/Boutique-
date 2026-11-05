#!/usr/bin/env node
// Repère, dans la galerie Icecat de chaque produit, la photo de l'emballage d'origine et la place juste après
// la photo principale. Icecat ne précise pas ce que montre chaque photo : un modèle de vision (CLIP, exécuté en
// local, sans service payant) estime si la photo montre un carton.
//
// Le modèle est lourd : il n'est pas dans les dépendances du site. Pour lancer le script :
//   npm i --no-save @huggingface/transformers@3.7.5
//   node --env-file=.env.local --env-file=chemin/vers/import.env scripts/emballage-icecat.mjs
//
// Chaque produit n'est examiné qu'une fois (packaging_checked_at).

import { pipeline } from "@huggingface/transformers";

const THRESHOLD = 0.6; // Mesuré sur un échantillon : cartons entre 0,74 et 0,99, produits nus 0,41 au plus.
const BOX = [
  "a retail cardboard box",
  "a printed product packaging box with a picture of the product on it",
  "a closed gift box with a brand logo",
];
const OTHER = [
  "an electronic device without packaging",
  "a close-up of a computer component",
  "a person using a gadget",
  "a diagram or a screenshot",
];

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

const classify = await pipeline("zero-shot-image-classification", "Xenova/clip-vit-base-patch32", { dtype: "fp32" });

async function boxScore(image) {
  try {
    const r = await classify(image, [...BOX, ...OTHER]);
    return r.filter((x) => BOX.includes(x.label)).reduce((s, x) => s + x.score, 0);
  } catch {
    return 0;
  }
}

let total = 0;
let boxes = 0;
for (;;) {
  const todo = await rpc("packaging_todo", { p_limit: 200 });
  if (!todo.length) break;
  const rows = [];
  for (const { ean, images } of todo) {
    // Les fabricants placent le plus souvent l'emballage en fin de galerie : on part de la fin.
    let found = -1;
    for (let i = images.length - 1; i >= 1; i--) {
      if ((await boxScore(images[i])) >= THRESHOLD) {
        found = i;
        break;
      }
    }
    const ordered = found > 1 ? [images[0], images[found], ...images.slice(1).filter((_, j) => j + 1 !== found)] : images;
    rows.push({ ean, images: ordered, has_packaging: found > 0 });
    if (found > 0) boxes++;
    total++;
    if (total % 25 === 0) process.stdout.write(`\r${total} produits examinés, ${boxes} emballages trouvés`);
  }
  await rpc("import_packaging", { p_rows: rows });
}
console.log(`\nTerminé : ${total} produits examinés, ${boxes} avec la photo de l'emballage.`);
