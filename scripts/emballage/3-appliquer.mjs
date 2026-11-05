// Applique les validations visuelles : la photo d'emballage confirmée passe en 2e position.
//   node appliquer.mjs candidats.jsonl valides.txt (numéros de ligne validés)
import fs from "node:fs";

const [cand, okFile, from, to] = process.argv.slice(2);
const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key, IMPORT_TOKEN: token } = process.env;
const all = fs.readFileSync(cand, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const lines = all.map((r, i) => ({ ...r, i })).slice(Number(from), Number(to));
const ok = new Set(fs.readFileSync(okFile, "utf8").split(/[\s,]+/).filter(Boolean).map(Number));

// Images parasites retirées des galeries (QR codes de garantie, dos d'emballage).
const JUNK = ["26028ffcf3b8273535b395bd29f1b10ee192459a", "eb4799713160dc2418d3b9c5d8a700a5a67cef1c", "587d55bbce8ae26910688e7b0b1da10f01e12d22"];
const clean = (list) => list.filter((u) => !JUNK.some((h) => u.includes(h)));

const rows = [];
lines.forEach((r0) => {
  const r = { ...r0, images: r0.images };
  if (r.best > 0 && JUNK.some((h) => r.images[r.best].includes(h))) r.best = -1;
  const after = (list) => clean(list);
  const i = r.i;
  if (ok.has(i) && r.best > 0) {
    const imgs = r.images;
    const b = r.best;
    rows.push({ ean: r.ean, images: after([imgs[0], imgs[b], ...imgs.slice(1).filter((_, j) => j + 1 !== b)]), has_packaging: true });
  } else {
    rows.push({ ean: r.ean, images: after(r.images), has_packaging: false });
  }
});

for (let i = 0; i < rows.length; i += 200) {
  const res = await fetch(`${url}/rest/v1/rpc/import_packaging`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, p_rows: rows.slice(i, i + 200) }),
  });
  if (!res.ok) throw new Error(await res.text());
}
console.log(rows.length, "produits enregistrés,", rows.filter((r) => r.has_packaging).length, "avec emballage");
