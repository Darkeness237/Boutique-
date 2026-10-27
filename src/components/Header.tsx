import Link from "next/link";
import { getCategoryTree } from "@/lib/catalog";
import { CartLink } from "./CartLink";
import { CategoryDrawer } from "./CategoryDrawer";
import { Logo } from "./Logo";

export async function Header() {
  const tree = await getCategoryTree();
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
          <input id="q" name="q" type="search" placeholder="RTX 5070, Ryzen 7, AM5…" maxLength={80} autoComplete="off" />
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
      <div className="header-sub">
        <div className="wrap header-sub-row">
          <CategoryDrawer tree={tree} />
          <nav aria-label="Raccourcis" className="header-shortcuts">
            <Link href="/catalogue?promo=1" className="shortcut-deal">
              Offres du moment
            </Link>
            <Link href="/#config">Config du moment</Link>
            <Link href="/catalogue?dispo=1&prixMax=20&tri=prix-croissant">Petits prix</Link>
            <Link href="/catalogue/cartes-graphiques?dispo=1">Cartes graphiques</Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
