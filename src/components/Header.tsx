import Link from "next/link";
import { getCategoryTree } from "@/lib/catalog";
import { CartLink } from "./CartLink";
import { FavoritesLink } from "./FavoritesProvider";
import { CategoryDrawer } from "./CategoryDrawer";
import { Logo } from "./Logo";
import { MarketSwitch } from "./MarketSwitch";
import { getMarket } from "@/lib/market-server";
import { CAMEROON_ENABLED } from "@/lib/market";
import { hasSessionCookie } from "@/lib/supabase-server";

export async function Header() {
  const [tree, market, signedIn] = await Promise.all([getCategoryTree(), getMarket(), hasSessionCookie()]);
  return (
    <header className="site-header">
      <a href="#contenu" className="skip-link">
        Aller au contenu
      </a>
      <div className="header-row wrap">
        <Link href="/" className="header-logo" aria-label="Vetex PC, accueil">
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
        <nav className="header-actions" aria-label="Pays, compte et panier">
          {CAMEROON_ENABLED && <MarketSwitch />}
          <Link href={signedIn ? "/compte" : "/connexion"} className="header-link">
            {signedIn ? "Mon compte" : "Se connecter"}
          </Link>
          <FavoritesLink />
          <CartLink />
        </nav>
      </div>
      <div className="header-sub">
        <div className="wrap header-sub-row">
          <CategoryDrawer tree={tree} />
          <nav aria-label="Raccourcis" className="header-shortcuts">
            {market === "fr" && (
              <Link href="/catalogue?promo=1" className="shortcut-deal">
                Offres du moment
              </Link>
            )}
            <Link href="/configs">Configs PC complètes</Link>
            <Link href="/catalogue?dispo=1&prixMax=20&tri=prix-croissant">Petits prix</Link>
            <Link href="/catalogue/cartes-graphiques?dispo=1">Cartes graphiques</Link>
            <Link href="/suivi" className="shortcut-help">Suivre ma commande</Link>
            <Link href="/aide" className="shortcut-help">Aide</Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
