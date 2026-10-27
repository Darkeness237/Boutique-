# Silicium — boutique de composants PC et matériel gaming

Front-end de la boutique en ligne (Next.js 15, React 19, TypeScript).

## Démarrer

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

`npm run build && npm start` pour tester la version de production.

## Ce qui existe

| Page | Chemin |
|---|---|
| Accueil, avec une config vérifiée (compatibilité calculée) | `/` |
| Catalogue, recherche et filtres (marque, prix, stock, tri) | `/catalogue`, `/catalogue/[categorie]` |
| Fiche produit, fiche technique et pièces compatibles | `/produit/[slug]` |
| Panier (stocké dans le navigateur) | `/panier` |
| Connexion / création de compte (interface seulement) | `/connexion`, `/inscription` |
| Mentions légales, CGV, confidentialité (modèles à compléter) | `/mentions-legales`, `/cgv`, `/confidentialite` |

Le catalogue vient de **Supabase** (projet `silicium`, région Paris), alimenté par les fichiers tarifs des fournisseurs.

## Importer un fichier fournisseur

```bash
node --env-file=.env.local --env-file=/chemin/hors/du/projet/import.env \
  scripts/import-fournisseur.mjs 1fotrade 1fotrade_price.csv
```

`import.env` contient `IMPORT_TOKEN` : gardez-le **hors du dossier du projet**. Le script filtre les familles PC et gaming,
bloque les prix aberrants et envoie le tout à la base. La base choisit la meilleure offre par EAN (en stock, prix, délai)
et calcule le prix de vente selon les marges de `docs/strategie-prix.md`.

Le schéma est dans `supabase/migrations/`. Les prix d'achat ne sont lisibles par personne avec la clé publique.

## Sécurité déjà en place

- **CSP stricte avec nonce** par requête (`src/middleware.ts`) : aucun script tiers ou injecté ne peut s'exécuter.
- **En-têtes** HSTS, anti-clickjacking, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (`next.config.ts`).
- **Toutes les entrées sont validées** avec zod : paramètres d'URL (allowlist des marques et des tris), panier, formulaires.
- **Le panier ne stocke que des identifiants et des quantités** : les prix viennent toujours du catalogue, et le serveur les recalculera au paiement.
- **Aucune carte bancaire ne transitera par le site** : le paiement passera par Stripe Checkout.
- **Polices auto-hébergées** : aucune requête vers Google, donc pas de transfert de l'adresse IP des visiteurs (RGPD).
- **Aucun secret dans le code** : `.env*` est ignoré par Git, seules les variables `NEXT_PUBLIC_*` (publiques) vont au navigateur.

## Prochaines étapes

1. Base Supabase : produits, stock, clients, commandes, avec RLS sur chaque table.
2. Authentification Supabase (connexion, inscription, 2FA pour les administrateurs).
3. Paiement Stripe Checkout et webhook qui enregistre la vente.
4. Espace client (commandes, factures) et back-office (stock, commandes).
5. Mise en ligne sur Netlify, nom de domaine, audit de sécurité avant lancement.
