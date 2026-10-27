import Link from "next/link";
import { getBrands, getCategoryTree, PAGE_SIZE, searchProducts, type Category } from "@/lib/catalog";
import { filtersToQuery, parseFilters, SORTS } from "@/lib/filters";
import { ProductCard } from "./ProductCard";
import { SideNav } from "./SideNav";
import { getMarket } from "@/lib/market-server";

export async function CatalogView({
  category,
  searchParams,
}: {
  category?: Category;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const [brands, tree, market] = await Promise.all([getBrands(category?.slug), getCategoryTree(), getMarket()]);
  const node = category ? tree.find((n) => n.slug === category.slug) : undefined;
  const filters = parseFilters(searchParams, brands, node?.subs.map((s) => s.slug) ?? []);
  const sub = node?.subs.find((s) => s.slug === filters.sous);

  const { items, total } = await searchProducts({
    category: category?.slug,
    subcategory: filters.sous,
    q: filters.q,
    brands: filters.marque,
    // Le prix maximum est saisi en euros en France, en francs CFA au Cameroun.
    maxPriceCents: filters.prixMax ? (market === "cm" ? filters.prixMax : filters.prixMax * 100) : undefined,
    inStockOnly: filters.dispo,
    promoOnly: market === "fr" && filters.promo,
    sort: filters.tri,
    market,
    page: filters.page,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const action = category ? `/catalogue/${category.slug}` : "/catalogue";
  const title = filters.q
    ? `Résultats pour « ${filters.q} »`
    : filters.promo && !category
      ? "Offres du moment"
      : (sub?.name ?? category?.name ?? "Tout le catalogue");

  return (
    <>
      <div className="wrap page-head">
        <ol className="breadcrumb" aria-label="Fil d'Ariane">
          <li>
            <Link href="/">Accueil</Link>
          </li>
          <li>
            <Link href="/catalogue">Catalogue</Link>
          </li>
          {category && (
            <li aria-current={sub ? undefined : "page"}>
              {sub ? <Link href={action}>{category.name}</Link> : category.name}
            </li>
          )}
          {sub && <li aria-current="page">{sub.name}</li>}
        </ol>
        <h1>{title}</h1>
        {category && !sub && <p className="lede">{category.hint}</p>}
        {market === "cm" && (
          <p className="market-note">
            Prix livrés au Cameroun : transport, dédouanement et TVA camerounaise compris, sans TVA française.
          </p>
        )}
      </div>

      <div className="wrap catalog-layout">
        <aside className="catalog-aside">
          <SideNav tree={tree} current={category?.slug} currentSub={filters.sous} />

          <form className="filters" method="get" action={action} aria-label="Filtres">
            {filters.q && <input type="hidden" name="q" value={filters.q} />}
            {filters.sous && <input type="hidden" name="sous" value={filters.sous} />}
            <p className="sidenav-title">Affiner</p>
            <div>
              <label className="field-label" htmlFor="tri">
                Trier par
              </label>
              <select id="tri" name="tri" defaultValue={filters.tri}>
                {Object.entries(SORTS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {market === "fr" && (
              <label className="check-row">
                <input type="checkbox" name="promo" value="1" defaultChecked={filters.promo} />
                En promotion
              </label>
            )}
            <label className="check-row">
              <input type="checkbox" name="dispo" value="1" defaultChecked={filters.dispo} />
              En stock uniquement
            </label>
            <div>
              <label className="field-label" htmlFor="prixMax">
                Prix maximum ({market === "cm" ? "FCFA" : "€"})
              </label>
              <input
                id="prixMax"
                name="prixMax"
                type="number"
                inputMode="numeric"
                min={1}
                max={market === "cm" ? 50_000_000 : 20000}
                step={market === "cm" ? 1000 : 1}
                defaultValue={filters.prixMax}
              />
            </div>
            <fieldset>
              <legend>Marque</legend>
              <div className="brand-list">
                {brands.map((b) => (
                  <label key={b} className="check-row">
                    <input type="checkbox" name="marque" value={b} defaultChecked={filters.marque.includes(b)} />
                    {b}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="filters-actions">
              <button type="submit" className="btn btn-dark btn-sm">
                Appliquer
              </button>
              <Link href={action}>Réinitialiser</Link>
            </div>
          </form>
        </aside>

        <div>
          {node && node.subs.length > 0 && (
            <nav className="sub-chips" aria-label={`Sous-catégories ${node.name}`}>
              <Link href={action} className={`chip ${!filters.sous ? "is-on" : ""}`}>
                Tout
              </Link>
              {node.subs
                .filter((s) => s.count > 0)
                .map((s) => (
                  <Link key={s.slug} href={`${action}?sous=${s.slug}`} className={`chip ${filters.sous === s.slug ? "is-on" : ""}`}>
                    {s.name}
                  </Link>
                ))}
            </nav>
          )}
          <p className="result-count" role="status">
            {total.toLocaleString("fr-FR")} produit{total > 1 ? "s" : ""}
            {pages > 1 && ` · page ${filters.page} sur ${pages}`}
          </p>
          {items.length > 0 ? (
            <>
              <div className="product-grid">
                {items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              {pages > 1 && (
                <nav className="pagination" aria-label="Pages de résultats">
                  {filters.page > 1 ? (
                    <Link href={`${action}${filtersToQuery(filters, filters.page - 1)}`} className="btn btn-quiet btn-sm">
                      Page précédente
                    </Link>
                  ) : (
                    <span />
                  )}
                  {filters.page < pages && (
                    <Link href={`${action}${filtersToQuery(filters, filters.page + 1)}`} className="btn btn-quiet btn-sm">
                      Page suivante
                    </Link>
                  )}
                </nav>
              )}
            </>
          ) : (
            <div className="empty">
              <h2>Aucun produit ne correspond</h2>
              <p>Retirez un filtre ou élargissez le prix maximum pour voir plus de résultats.</p>
              <Link href={action} className="btn btn-quiet">
                Réinitialiser les filtres
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
