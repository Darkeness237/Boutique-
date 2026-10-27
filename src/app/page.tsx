import Link from "next/link";
import { BuildPanel } from "@/components/BuildPanel";
import { Countdown } from "@/components/Countdown";
import { HeroBanners, type Banner } from "@/components/HeroBanners";
import { ProductCard } from "@/components/ProductCard";
import { ProductRail } from "@/components/ProductRail";
import { ProductVisual } from "@/components/ProductVisual";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { SideNav } from "@/components/SideNav";
import { Ticker } from "@/components/Ticker";
import { FREE_SHIPPING_CENTS } from "@/lib/cart";
import { getCategories, getCategoryTree, getTopBrands, inStock, type Product } from "@/lib/catalog";
import { dealsIn, type Deal } from "@/lib/deals";
import { formatPrice } from "@/lib/format";
import type { Market } from "@/lib/market";
import { getMarket } from "@/lib/market-server";

const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });

// Rayons mis en avant : produits en stock, avec photo, au-dessus d'un prix plancher
// (pour ne pas exposer en vitrine des bouchons ou des adaptateurs).
const RAILS: { category: string; title: string; minEuros: number }[] = [
  { category: "cartes-graphiques", title: "Cartes graphiques en stock", minEuros: 250 },
  { category: "stockage", title: "SSD et stockage", minEuros: 40 },
  { category: "boitiers", title: "Boîtiers", minEuros: 60 },
];

const COVER_MIN_EUROS: Record<string, number> = {
  "cartes-graphiques": 250, processeurs: 150, "cartes-meres": 100, memoire: 60, stockage: 50,
  alimentations: 60, boitiers: 60, refroidissement: 60, ecrans: 120, peripheriques: 30, fauteuils: 100,
};

const DEAL_CATEGORIES = ["refroidissement", "peripheriques", "boitiers"];

/** Bannières du Cameroun : pas de promotions là-bas pour l'instant, on met en avant le service. */
function cmBanners(gpu: Product | undefined, ssd: Product | undefined): Banner[] {
  return [
    {
      id: "cm-livraison",
      kicker: "Livraison à Douala et Yaoundé",
      title: "Vos pièces PC livrées chez vous, douane comprise",
      text: "Prix tout compris en FCFA : transport par avion, dédouanement et TVA camerounaise inclus.",
      cta: "Voir les cartes graphiques",
      href: "/catalogue/cartes-graphiques?dispo=1",
      image: gpu?.image_url ?? null,
      tone: "violet",
    },
    {
      id: "config",
      kicker: "Compatibilité vérifiée",
      title: "La config du moment, prête à monter",
      text: "Processeur, carte mère, mémoire, carte graphique et alimentation qui vont ensemble.",
      cta: "Voir la config",
      href: "#config",
      image: null,
      tone: "slate",
    },
    {
      id: "cm-stockage",
      kicker: "Légers à expédier",
      title: "SSD et mémoire : les meilleurs prix livrés",
      text: "Les petites pièces voyagent à moindre coût : idéal pour faire évoluer votre PC.",
      cta: "Voir le stockage",
      href: "/catalogue/stockage?dispo=1",
      image: ssd?.image_url ?? null,
      tone: "ice",
    },
  ];
}

function bannersFrom(deals: Deal[], gpu: Product | undefined): Banner[] {
  const titles: Record<string, string> = {
    refroidissement: "Refroidissement",
    peripheriques: "Souris, claviers, casques",
    boitiers: "Boîtiers",
  };
  const tones: Banner["tone"][] = ["violet", "slate", "ice"];
  const banners: Banner[] = deals.map((d, i) => ({
    id: d.category,
    kicker: `${d.label}, jusqu'au ${day.format(new Date(d.endsAt))}`,
    title: `${titles[d.category] ?? d.category} : jusqu'à −${d.maxPct} %`,
    text: `${d.items.length > 20 ? "Des dizaines de" : d.items.length} produits en stock à prix réduit.`,
    cta: "Voir les offres",
    href: `/catalogue/${d.category}?promo=1&dispo=1`,
    image: d.items.find((p) => p.price_cents >= 4000)?.image_url ?? d.items[0]?.image_url ?? null,
    tone: tones[i % tones.length],
  }));
  banners.splice(1, 0, {
    id: "config",
    kicker: "Compatibilité vérifiée",
    title: "La config du moment, prête à monter",
    text: "Processeur, carte mère, mémoire, carte graphique et alimentation qui vont ensemble.",
    cta: "Voir la config",
    href: "#config",
    image: gpu?.image_url ?? null,
    tone: "slate",
  });
  return banners;
}

export default async function HomePage() {
  const [tree, categories, market] = await Promise.all([getCategoryTree(), getCategories(), getMarket()]);
  const cm = market === "cm";
  const [deals, rails, smallPrices, covers, brands, gpus, ssds] = await Promise.all([
    cm
      ? Promise.resolve([] as Deal[])
      : Promise.all(DEAL_CATEGORIES.map((c) => dealsIn(c))).then((l) => l.filter((d): d is Deal => d !== null)),
    Promise.all(RAILS.map((r) => inStock(r.category, { minPriceCents: r.minEuros * 100, withImage: true, market }, 14))),
    inStock(null, { withImage: true, minPriceCents: 500, maxPriceCents: 2000, market }, 16),
    Promise.all(
      categories.map(async (c) => {
        const list = await inStock(c.slug, { minPriceCents: (COVER_MIN_EUROS[c.slug] ?? 10) * 100, withImage: true, market }, 5);
        return [c.slug, list[Math.min(2, list.length - 1)] ?? null] as [string, Product | null];
      }),
    ),
    getTopBrands(28),
    inStock("cartes-graphiques", { withImage: true, minPriceCents: 40000, market }, 5),
    cm ? inStock("stockage", { withImage: true, subcategory: "ssd-nvme", minPriceCents: 6000, market }, 5) : Promise.resolve([]),
  ]);
  const coverBySlug = new Map(covers);

  // Les meilleures remises de chaque rayon, quatre par rayon au plus.
  const dealItems = deals.flatMap((d) => d.items.slice(0, 4)).slice(0, 12);
  const soonest = deals.map((d) => d.endsAt).sort()[0];

  return (
    <>
      <div className="wrap home-top">
        <aside className="home-aside">
          <SideNav tree={tree} title="Tous les rayons" />
        </aside>
        <HeroBanners banners={cm ? cmBanners(gpus[0], ssds[0]) : bannersFrom(deals, gpus[0])} />
      </div>

      <PromiseStrip market={market} />

      {dealItems.length > 0 && (
        <section className="wrap section section-tight" aria-labelledby="deals-title">
          <div className="deals-panel">
            <div className="section-head">
              <div>
                <h2 id="deals-title">Offres du moment</h2>
                {soonest && (
                  <p className="deals-timer">
                    <Countdown endsAt={soonest} prefix="Prochaine fin d'offre dans" />
                  </p>
                )}
              </div>
              <Link href="/catalogue?promo=1&dispo=1">Toutes les offres</Link>
            </div>
            <ProductRail label="Offres du moment">
              {dealItems.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </ProductRail>
          </div>
        </section>
      )}

      <section className="wrap section config-section" id="config" aria-labelledby="config-title">
        <div className="config-copy">
          <h2 id="config-title">Des pièces qui vont ensemble.</h2>
          <p className="hero-lede">
            La compatibilité est vérifiée pour vous : même socket, bon type de mémoire, alimentation assez puissante. La
            config ci-contre est composée avec ce que nous avons en stock aujourd&apos;hui.
          </p>
          <Link href="/catalogue/processeurs?dispo=1" className="btn btn-quiet btn-lg">
            Composer ma config
          </Link>
        </div>
        <BuildPanel />
      </section>

      <section className="wrap section section-tight" aria-labelledby="cats-title">
        <div className="section-head">
          <h2 id="cats-title">Par catégorie</h2>
        </div>
        <ul className="cat-grid">
          {categories.map((c) => {
            const cover = coverBySlug.get(c.slug);
            return (
              <li key={c.slug}>
                <Link href={`/catalogue/${c.slug}`} className="cat-tile">
                  <span className="cat-tile-img" aria-hidden="true">
                    {cover?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover.image_url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                    ) : (
                      <ProductVisual category={c.slug} />
                    )}
                  </span>
                  <span className="cat-name">{c.name}</span>
                  <span className="cat-hint">{c.hint}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {smallPrices.length > 0 && (
        <section className="wrap section section-tight" aria-labelledby="small-title">
          <div className="section-head">
            <h2 id="small-title">{cm ? "Petits prix" : "Petits prix, moins de 20 €"}</h2>
            <Link href="/catalogue?dispo=1&prixMax=20&tri=prix-croissant">Tout voir</Link>
          </div>
          <ProductRail label="Petits prix">
            {smallPrices.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </ProductRail>
        </section>
      )}

      {brands.length > 0 && <Ticker label="Marques disponibles" items={brands} tone="dark" />}

      {RAILS.map((r, i) =>
        rails[i].length > 0 ? (
          <section key={r.category} className="wrap section section-tight" aria-labelledby={`rail-${r.category}`}>
            <div className="section-head">
              <h2 id={`rail-${r.category}`}>{r.title}</h2>
              <Link href={`/catalogue/${r.category}?dispo=1`}>Tout voir</Link>
            </div>
            <ProductRail label={r.title}>
              {rails[i].map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </ProductRail>
          </section>
        ) : null,
      )}

      <RecentlyViewed title="Reprendre là où vous en étiez" />
    </>
  );
}

function PromiseStrip({ market }: { market: Market }) {
  const items =
    market === "cm"
      ? [
          ["Prix tout compris", "douane et TVA incluses"],
          ["Livré à domicile", "à Douala et Yaoundé"],
          ["Garantie 2 ans", "sur tout le catalogue"],
          ["Mobile Money", "Orange Money et MTN MoMo"],
        ]
      : [
          ["Livraison offerte", `dès ${formatPrice(FREE_SHIPPING_CENTS)}`],
          ["14 jours", "pour changer d'avis"],
          ["Garantie 2 ans", "sur tout le catalogue"],
          ["Paiement sécurisé", "par Stripe"],
        ];
  return (
    <div className="wrap promise-strip">
      {items.map(([strong, rest]) => (
        <p key={strong}>
          <strong>{strong}</strong> {rest}
        </p>
      ))}
    </div>
  );
}
