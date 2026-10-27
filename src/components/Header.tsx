import Link from "next/link";
import { getCategories } from "@/lib/catalog";
import { CartLink } from "./CartLink";
import { Logo } from "./Logo";

export async function Header() {
  const categories = await getCategories();
  return (
    <header className="site-header">
      <a href="#contenu" className="skip-link">
        Aller au contenu
      </a>
      <div className="header-row wrap">
        <Link href="/" className="header-logo" aria-label="Silicium, accueil">
          <Logo />
        </Link>
        <form action="/catalogue" method="get" role="search" className="header-search">
          <label htmlFor="q" className="visually-hidden">
            Rechercher un produit
          </label>
          <input
            id="q"
            name="q"
            type="search"
            placeholder="RTX 5070, Ryzen 7, AM5…"
            maxLength={80}
            autoComplete="off"
          />
          <button type="submit" className="btn btn-dark btn-sm">
            Rechercher
          </button>
        </form>
        <nav className="header-actions" aria-label="Compte et panier">
          <Link href="/connexion" className="header-link">
            Se connecter
          </Link>
          <CartLink />
        </nav>
      </div>
      <nav className="header-cats" aria-label="Catégories">
        <ul className="wrap">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={`/catalogue/${c.slug}`}>{c.name}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
