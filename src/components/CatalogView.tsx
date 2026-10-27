import Link from "next/link";
import { products, productsIn, type Category } from "@/lib/catalog";
import { applyFilters, parseFilters, SORTS } from "@/lib/filters";
import { ProductCard } from "./ProductCard";

export function CatalogView({
  category,
  searchParams,
}: {
  category?: Category;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const base = category ? productsIn(category.slug) : products;
  const filters = parseFilters(searchParams);
  const results = applyFilters(base, filters);
  const brandsHere = [...new Set(base.map((p) => p.brand))].sort((a, b) => a.localeCompare(b, "fr"));
  const action = category ? `/catalogue/${category.slug}` : "/catalogue";

  const title = filters.q ? `Résultats pour « ${filters.q} »` : category ? category.name : "Tout le catalogue";

  return (
    <>
      <div className="wrap page-head">
        <ol className="breadcrumb" aria-label="Fil d'Ariane">
          <li>
            <Link href="/">Accueil</Link>
          </li>
          {category ? (
            <>
              <li>
                <Link href="/catalogue">Catalogue</Link>
              </li>
              <li aria-current="page">{category.name}</li>
            </>
          ) : (
            <li aria-current="page">Catalogue</li>
          )}
        </ol>
        <h1>{title}</h1>
        {category && <p className="lede">{category.hint}</p>}
      </div>

      <div className="wrap catalog-layout">
        <form className="filters" method="get" action={action} aria-label="Filtres">
          {filters.q && <input type="hidden" name="q" value={filters.q} />}
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
          <fieldset>
            <legend>Marque</legend>
            {brandsHere.map((b) => (
              <label key={b} className="check-row">
                <input type="checkbox" name="marque" value={b} defaultChecked={filters.marque.includes(b)} />
                {b}
              </label>
            ))}
          </fieldset>
          <div>
            <label className="field-label" htmlFor="prixMax">
              Prix maximum (€)
            </label>
            <input
              id="prixMax"
              name="prixMax"
              type="number"
              inputMode="numeric"
              min={1}
              max={10000}
              step={1}
              defaultValue={filters.prixMax}
            />
          </div>
          <label className="check-row">
            <input type="checkbox" name="dispo" value="1" defaultChecked={filters.dispo} />
            En stock uniquement
          </label>
          <div className="filters-actions">
            <button type="submit" className="btn btn-dark btn-sm">
              Appliquer
            </button>
            <Link href={action}>Réinitialiser</Link>
          </div>
        </form>

        <div>
          <p className="result-count" role="status">
            {results.length} produit{results.length > 1 ? "s" : ""}
          </p>
          {results.length > 0 ? (
            <div className="product-grid">
              {results.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
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
