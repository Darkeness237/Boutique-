# Module pricing intelligent : conception

Objectif : vendre plus en restant compétitif, sans jamais vendre à perte ni descendre sous une marge maîtrisée.
Principe directeur : **réutiliser l'existant** (import 1foTrade, moteur de promotions, planchers de prix, historique,
espace admin) et n'ajouter que ce qui manque.

---

## 1. Analyse de l'existant

| Brique | Où | État |
|---|---|---|
| Import du flux 1foTrade | `scripts/import-fournisseur.mjs`, fonctions `import_start/offers/finish`, tâche GitHub horaire (SFTP Storage Box) | ✅ en place |
| Offres fournisseur | `supplier_offers` (coût HT, stock oui/non, quarantaine, `previous_cost_cents`) | ⚠️ un seul coût précédent, pas d'historique |
| Calcul du prix de vente | `private.refresh_products()` : coût × 1,2 × (1 + marge catégorie), minimum en €, arrondi à ,90 | ✅ à étendre |
| Marges | `categories.margin_pct`, `categories.min_margin_cents` | ✅ réutilisées |
| Plancher anti-perte | `products.floor_cents` | ✅ réutilisé |
| Promotions | table `promotions`, `apply_promotions()` (cron horaire), prix de référence légal sur 30 jours | ✅ réutilisé pour les promos fournisseur |
| Historique | `price_history` (prix de vente seulement) | ⚠️ à compléter |
| Admin | `/admin`, rôle `admin` (RLS, `is_admin()`) | ✅ on ajoute des pages |
| Vitrine | badge promo, « Offres du moment », bannières accueil, prix barré | ✅ inchangé |

Contraintes relevées :
- Le fichier 1foTrade ne contient **pas de colonne promotion** et le stock est **oui/non** (pas de quantité).
- Statut micro-entrepreneur en franchise de TVA : la TVA payée à 1foTrade n'est pas récupérable, le coût réel en
  France est donc **HT × 1,20**. Pour le Cameroun (export), le coût est HT.
- Aucun champ produit n'est saisi à la main aujourd'hui : « ne pas écraser vos données » se traduit par de
  **nouvelles colonnes réservées aux saisies manuelles**, que l'import ne touche jamais.

## 2. Modifications à apporter (sans casser l'existant)

1. **Historique du coût fournisseur** : chaque changement de coût ou de stock est journalisé (déclencheur sur
   `supplier_offers`), ce qui permet de détecter les promotions fournisseur.
2. **Promotions fournisseur déduites** : baisse du coût ≥ 8 % par rapport à la médiane des 30 derniers jours, ou
   prix redevenu normal → fin. Elles alimentent la table `promotions` existante (badge, rubrique, accueil).
3. **Prix concurrents** : collecteur respectueux + import CSV, historisés.
4. **Moteur de pricing** : calcule un prix conseillé ; application **mixte** (voir §5).
5. **Surcharges manuelles** : prix imposé, marge minimale propre au produit, exclusion du repricing, mise en avant.
   L'import ne touche jamais ces champs.
6. **Alertes** et **historique des marges**.

## 3. Schéma SQL ajouté (strictement nécessaire)

```
private.pricing_settings        -- un seul enregistrement : frais, bandes de positionnement, seuils
  stripe_pct, stripe_fixed_cents, packaging_cents, aftersale_pct (provision SAV/retours),
  target_below_min_pct (3), target_below_max_pct (6), auto_apply_max_change_pct (5),
  supplier_promo_drop_pct (8), max_daily_change_pct

public.product_overrides         -- saisies manuelles, jamais écrasées par l'import
  product_id PK, fixed_price_cents, min_margin_pct, min_margin_cents, exclude_from_repricing,
  featured, note, updated_at

public.supplier_cost_history     -- évolution du coût fournisseur et du stock
  supplier_id, supplier_sku, cost_cents, in_stock, recorded_at

public.competitors               -- sites suivis
  id, name, domain, active, robots_ok (dernier contrôle), last_checked_at

public.competitor_prices         -- relevés (historique complet)
  product_id, competitor_id, price_cents, in_stock, url, source ('collecteur' | 'csv'), observed_at

public.competitor_urls           -- correspondance produit ↔ page concurrente (trouvée par EAN ou saisie)
  product_id, competitor_id, url

public.pricing_suggestions       -- dernier calcul du moteur par produit
  product_id PK, cost_real_cents, floor_cents, market_min/avg/max_cents, cheapest_competitor_id,
  suggested_cents, current_cents, margin_cents, margin_pct, rank, status ('bien' | 'trop_cher' |
  'tres_competitif' | 'marge_insuffisante' | 'sans_donnees'), decision ('auto' | 'a_valider' |
  'applique' | 'refuse'), computed_at

public.margin_history            -- marge réalisée au fil du temps (1 ligne par changement de prix ou de coût)
public.pricing_alerts            -- alertes : type, product_id, message, created_at, read_at
```

Toutes ces tables sont protégées par RLS : lecture et écriture **admin uniquement** (`is_admin()`). Les prix
concurrents et les coûts ne sont jamais exposés aux visiteurs.

## 4. Services backend

| Service | Rôle |
|---|---|
| `private.real_cost(product)` | coût réel = coût HT × 1,20 (France) + emballage + frais Stripe estimés + provision SAV |
| `private.price_floor(product)` | plancher = coût réel + max(marge % catégorie ou produit, minimum €), arrondi à ,90 |
| `private.compute_suggestions()` | pour chaque produit : statistiques marché, prix conseillé, statut, décision |
| `private.apply_suggestions()` | applique automatiquement les changements ≤ 5 %, met les autres « à valider » |
| `private.detect_supplier_promos()` | déduit les promotions fournisseur à partir de l'historique des coûts |
| `private.raise_alerts()` | crée les alertes |
| `scripts/collecte-prix.mjs` | collecteur de prix concurrents (voir §8) |
| actions serveur admin | valider ou refuser un prix, valider en masse, surcharges, import CSV des prix |

### Méthode de marge retenue (« contribution » plutôt que pourcentage brut)

Un pourcentage seul est trompeur sur les petits prix (une marge de 6 % sur un article à 15 € ne couvre pas les
frais). Le plancher retenu est donc :

```
coût réel   = coût HT × 1,20 + emballage + frais Stripe (1,5 % + 0,25 €) + provision SAV (1 %)
plancher    = coût réel + max(coût réel × marge mini %, marge mini en €)
```

- marge mini % : celle de la catégorie (6 à 30 %), ou celle du produit si vous en fixez une ;
- marge mini € : celle de la catégorie (8 à 15 €) : elle protège les petits prix ;
- **aucun prix, automatique ou manuel, ne peut descendre sous ce plancher**.

### Prix conseillé

```
cible       = prix moyen du marché × (1 − 4,5 %)   (milieu de la bande 3–6 %, réglable)
conseillé   = arrondi à ,90 de max(cible, plancher)
```

- s'il existe un concurrent moins cher que la cible mais au-dessus du plancher, on s'aligne juste en dessous
  de lui, dans la limite de la bande de 6 % ;
- si le plancher dépasse le prix moyen : statut **📉 Marge insuffisante**, et le prix reste au plancher.

Votre exemple : coût réel 120 €, moyenne 160 € → cible 152,80 € → **152,90 €** (marge ≈ 27 %).

### Statuts du tableau de bord

| Indicateur | Règle |
|---|---|
| 🔥 Très compétitif | prix ≤ prix le plus bas du marché |
| ✅ Bien positionné | prix entre −6 % et +0 % de la moyenne |
| ⚠️ Trop cher | prix > moyenne |
| 📉 Marge insuffisante | plancher > prix conseillé par le marché |
| — Sans données | aucun relevé concurrent de moins de 7 jours |

### Application « mixte »

- variation ≤ 5 % et au-dessus du plancher → appliquée automatiquement, journalisée ;
- variation > 5 % → « à valider » dans le tableau de bord (un clic, ou validation en masse) ;
- produit avec prix imposé ou exclu du repricing → jamais modifié ;
- une baisse appliquée n'est **jamais affichée comme promotion** (pas de prix barré) : la règle légale des
  30 jours reste respectée par le moteur de promotions existant.

## 5. Évolutions frontend

- `/admin/pricing` : tableau filtrable (catégorie, statut, à valider), toutes les colonnes demandées, validation
  unitaire et en masse, surcharges par produit ;
- `/admin/pricing/[produit]` : courbes coût / prix de vente / marché / marge (historique) ;
- `/admin/alertes` : liste des alertes, compteur dans le menu admin ;
- `/admin/concurrents` : sites suivis, couverture, import CSV ;
- vitrine : badge « Promo fournisseur » et rubrique existante, avec en plus une sélection automatique
  « meilleures affaires » sur l'accueil (plus forte remise réelle, en stock, marge préservée).

## 6. Tâches planifiées

| Tâche | Fréquence | Où |
|---|---|---|
| Import 1foTrade | toutes les heures (existe) | GitHub Actions |
| Détection des promos fournisseur + suggestions + application auto + alertes | après chaque import, et toutes les heures | pg_cron (Supabase) |
| Collecte des prix concurrents | 1 fois par jour, la nuit, lente | GitHub Actions |
| Purge : relevés concurrents de plus de 18 mois agrégés par semaine | 1 fois par semaine | pg_cron |

## 7. Performances

- ~9 800 produits : le calcul des suggestions est une requête SQL unique (quelques secondes), indexée par produit.
- Historiques : on n'enregistre **que les changements** (déclencheurs), pas un instantané quotidien de tout le
  catalogue → quelques milliers de lignes par jour au maximum.
- Collecteur : limité aux produits en stock et vendus (priorité aux plus consultés et aux meilleures marges),
  quelques centaines de pages par jour → aucun impact sur le site.
- Le tableau de bord admin lit `pricing_suggestions` (pré-calculée) : affichage instantané, paginé.

## 8. Faisabilité technique et juridique des prix concurrents

**Juridique (France / UE)** : un prix affiché publiquement n'est pas protégé en soi, mais :
- les conditions d'utilisation de la plupart des grands sites interdisent la collecte automatisée (risque
  contractuel) ;
- le droit des producteurs de bases de données (art. L342-1 du Code de la propriété intellectuelle) interdit
  l'extraction d'une **partie substantielle** de leur catalogue ;
- contourner une mesure technique de protection (anti-robot, captcha, blocage d'adresse) peut constituer un accès
  frauduleux à un système informatique (art. 323-1 du Code pénal).

**Ce que fait le collecteur** :
- respecte `robots.txt` et s'arrête dès qu'un site bloque, sans jamais contourner de protection ;
- s'identifie honnêtement, une requête toutes les quelques secondes, quelques centaines de produits au plus ;
- ne lit que le prix et la disponibilité, de préférence dans les données structurées schema.org de la page ;
- ne stocke ni texte, ni photo, ni avis des concurrents.

**Conséquence pratique** : Amazon (conditions d'utilisation) est exclu du relevé automatique ; les autres sites sont relevés tant qu'ils ne bloquent pas, et ignorés dès qu'ils bloquent. Pour les couvrir
légalement : import CSV (relevé manuel des produits stratégiques) ou abonnement à un service de veille sous licence,
branchable plus tard sur la même table `competitor_prices`.

Ceci n'est pas un avis juridique : pour un usage à grande échelle, faire valider par un avocat.
