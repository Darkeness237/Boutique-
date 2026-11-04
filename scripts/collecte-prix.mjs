#!/usr/bin/env node
// Relève les prix des fiches concurrentes suivies (adresses saisies dans l'admin ou importées en CSV).
//
//   node --env-file=.env.local --env-file=chemin/vers/import.env scripts/collecte-prix.mjs [nombre_max]
//
// Règles (voir docs/module-pricing.md, §8) :
// - le fichier robots.txt de chaque site est lu et respecté ; une page interdite n'est pas visitée ;
// - une page à la fois par site, plusieurs secondes d'intervalle, quelques centaines de pages par nuit ;
// - au premier signe de blocage (403, 429, page anti-robot), le site est laissé de côté jusqu'au lendemain :
//   aucune protection n'est contournée ;
// - seuls le prix et la disponibilité sont lus, de préférence dans les données structurées schema.org.

const LIMIT = Math.min(Number(process.argv[2] ?? 400), 2000);
const DELAY_MS = 6000;
const BOT = "VetexPriceBot";
const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key, IMPORT_TOKEN: token, NEXT_PUBLIC_SITE_URL: site } =
  process.env;
if (!url || !key || !token) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY et IMPORT_TOKEN sont requis.");
  process.exit(1);
}
const USER_AGENT = `${BOT}/1.0 (+${site ?? "https://silicium-boutique.netlify.app"})`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// robots.txt ------------------------------------------------------------------------------------------
function parseRobots(text) {
  const groups = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === "user-agent") {
      if (!current || current.rules.length) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
    } else if ((field === "allow" || field === "disallow") && current) {
      current.rules.push({ allow: field === "allow", path: value });
    }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && BOT.toLowerCase().includes(a)));
  return (mine.length ? mine : groups.filter((g) => g.agents.includes("*"))).flatMap((g) => g.rules);
}

function allowed(rules, path) {
  let best = { allow: true, len: -1 };
  for (const r of rules) {
    if (!r.path) continue; // « Disallow: » vide = tout est permis
    const re = new RegExp(
      "^" + r.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"),
    );
    if (re.test(path) && r.path.length > best.len) best = { allow: r.allow, len: r.path.length };
  }
  return best.allow;
}

// Lecture du prix -------------------------------------------------------------------------------------
const BLOCK_MARKERS = /captcha|cf-chl|datadome|px-captcha|perimeterx|access denied|are you a robot|robot check/i;

function* walk(node) {
  if (Array.isArray(node)) for (const n of node) yield* walk(n);
  else if (node && typeof node === "object") {
    yield node;
    for (const v of Object.values(node)) if (v && typeof v === "object") yield* walk(v);
  }
}

const sameEan = (a, b) => String(a ?? "").replace(/^0+/, "") === String(b ?? "").replace(/^0+/, "");

function extract(html, ean) {
  let gtin = null;
  let price = null;
  let inStock = null;
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    for (const n of walk(data)) {
      const type = [].concat(n["@type"] ?? []).join(",");
      if (/Product/i.test(type)) gtin ??= n.gtin13 ?? n.gtin ?? n.gtin14 ?? n.gtin12 ?? n.ean ?? null;
      if (/Offer/i.test(type) && price === null) {
        const p = Number(String(n.price ?? n.lowPrice ?? "").replace(",", "."));
        if (Number.isFinite(p) && p > 0 && (!n.priceCurrency || n.priceCurrency === "EUR")) {
          price = p;
          if (n.availability) inStock = /InStock|LimitedAvailability/i.test(String(n.availability));
        }
      }
    }
  }
  if (price === null) {
    const meta =
      html.match(/itemprop=["']price["'][^>]*content=["']([\d.,]+)["']/i) ??
      html.match(/property=["']product:price:amount["'][^>]*content=["']([\d.,]+)["']/i);
    if (meta) price = Number(meta[1].replace(",", "."));
  }
  if (gtin && ean && !sameEan(gtin, ean)) return { status: "ean_different" };
  if (!price || !Number.isFinite(price)) return { status: "prix_introuvable" };
  return { status: "ok", price_cents: Math.round(price * 100), in_stock: inStock };
}

// Collecte ----------------------------------------------------------------------------------------------
const todo = await rpc("collector_todo", { p_limit: LIMIT });
const byDomain = new Map();
for (const t of todo) byDomain.set(t.domain, [...(byDomain.get(t.domain) ?? []), t]);
console.log(`${todo.length} page(s) à relever sur ${byDomain.size} site(s).`);

async function collectDomain(domain, items) {
  const results = [];
  let rules = [];
  try {
    const r = await fetch(`https://${domain}/robots.txt`, { headers: { "User-Agent": USER_AGENT } });
    if (r.status >= 500) throw new Error(`robots.txt HTTP ${r.status}`);
    rules = r.ok ? parseRobots(await r.text()) : [];
  } catch (e) {
    // Sans robots.txt lisible, on s'abstient (prudence).
    console.log(`${domain} : robots.txt illisible, site ignoré (${e.message})`);
    return items.map((t) => ({ ...t, status: "robots_illisible" }));
  }
  let blocked = false;
  for (const t of items) {
    const u = new URL(t.url);
    if (u.hostname !== domain) {
      results.push({ ...t, status: "adresse_invalide" });
      continue;
    }
    if (blocked) {
      results.push({ ...t, status: "site_bloque" });
      continue;
    }
    if (!allowed(rules, u.pathname + u.search)) {
      results.push({ ...t, status: "interdit_robots" });
      continue;
    }
    try {
      const res = await fetch(u, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html", "Accept-Language": "fr-FR,fr;q=0.9" },
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
      });
      const html = await res.text();
      if ([403, 429, 503].includes(res.status) || (res.status === 200 && html.length < 30000 && BLOCK_MARKERS.test(html))) {
        blocked = true; // on n'insiste pas : le site sera retenté demain
        results.push({ ...t, status: "site_bloque" });
      } else if (res.status === 404 || res.status === 410) {
        results.push({ ...t, status: "page_disparue" });
      } else if (!res.ok) {
        results.push({ ...t, status: `http_${res.status}` });
      } else {
        results.push({ ...t, ...extract(html, t.ean) });
      }
    } catch {
      results.push({ ...t, status: "erreur_reseau" });
    }
    await sleep(DELAY_MS);
  }
  const ok = results.filter((r) => r.status === "ok").length;
  console.log(`${domain} : ${ok}/${items.length} prix relevés${blocked ? " (site bloquant, arrêt)" : ""}`);
  return results;
}

const all = (await Promise.all([...byDomain].map(([d, items]) => collectDomain(d, items)))).flat();
for (let i = 0; i < all.length; i += 100) {
  const batch = all.slice(i, i + 100).map((r) => ({
    product_id: r.product_id,
    competitor_id: r.competitor_id,
    status: r.status,
    price_cents: r.price_cents ?? null,
    in_stock: r.in_stock ?? null,
  }));
  await rpc("collector_record", { p_rows: batch });
}
const summary = all.reduce((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {});
console.log("Résumé :", summary);
