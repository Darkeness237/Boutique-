// Pour chaque produit en stock avec galerie : la photo qui ressemble le plus à un carton (candidate à vérifier).
import { pipeline } from "@huggingface/transformers";
import fs from "node:fs";

const OUT = process.argv[2];
const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key, IMPORT_TOKEN: token } = process.env;
async function rpc(fn, args) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, ...args }),
  });
  if (!res.ok) throw new Error(`${fn} ${res.status} ${await res.text()}`);
  return res.json();
}
const BOX = ["a retail cardboard box", "a printed product packaging box with a picture of the product on it", "a closed gift box with a brand logo"];
const OTHER = ["an electronic device without packaging", "a close-up of a computer component", "a person using a gadget", "a diagram or a screenshot"];
const clf = await pipeline("zero-shot-image-classification", "Xenova/clip-vit-base-patch32", { dtype: "q8" });

const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l).ean) : []);
const todo = [];
for (let off = 0; ; off += 1000) {
  const page = await rpc("packaging_candidates", { p_limit: 1000, p_offset: off });
  todo.push(...page);
  if (page.length < 1000) break;
}
console.log("produits", todo.length);
let n = 0;
for (const { ean, images } of todo) {
  if (done.has(ean)) continue;
  let best = -1, bestScore = 0;
  for (let i = 1; i < images.length; i++) {
    try {
      const r = await clf(images[i], [...BOX, ...OTHER]);
      const s = r.filter((x) => BOX.includes(x.label)).reduce((a, x) => a + x.score, 0);
      if (s > bestScore) { bestScore = s; best = i; }
    } catch {}
  }
  fs.appendFileSync(OUT, JSON.stringify({ ean, images, best, score: Number(bestScore.toFixed(3)) }) + "\n");
  if (++n % 50 === 0) console.log(n);
}
console.log("fin", n);
