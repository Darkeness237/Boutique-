# Stratégie de prix — Silicium

Version du 27 octobre 2026. Les marges sont stockées dans la table `categories` de Supabase :
les modifier là-bas recalcule tout le catalogue au prochain import.

## Le constat

- **Les prix d'achat 1foTrade sont proches des prix publics** sur les grosses pièces.
  Exemple : Ryzen 7 9800X3D acheté 366,58 € HT, soit 439,90 € TTC ; il se vend entre 425 et 470 €
  chez les grands marchands (relevés de juillet 2026, à refaire).
- **Les cartes graphiques ont pris environ 25 % en 3 mois** (Comparateur Gamer, octobre 2026),
  et la mémoire DDR5 est très chère : un kit de 32 Go dépasse 500 €.
- Sur ces produits, **on ne battra pas LDLC ou Amazon sur le prix**. On peut seulement être au même niveau.
- 1foTrade est très fort sur **les boîtiers, le refroidissement et les périphériques** (des milliers
  de références en stock), où les marges du marché sont plus larges.

## La règle de prix

```
prix de vente = max( coût TTC × (1 + marge %), coût TTC + marge minimale en € )
puis arrondi au ,90 supérieur
```

Le coût TTC est le prix fournisseur HT × 1,2. En micro-entreprise sous franchise de TVA,
la TVA payée au fournisseur n'est pas récupérable : c'est donc un vrai coût. Si l'entreprise
devient assujettie, la formule reste juste (le prix affiché inclut alors la TVA collectée).

| Catégorie | Marge | Minimum | Rôle |
|---|---|---|---|
| Processeurs | 6 % | 12 € | Produit d'appel : être dans le prix du marché |
| Cartes graphiques | 6 % | 15 € | Produit d'appel |
| Cartes mères | 10 % | 8 € | |
| Mémoire | 10 % | 6 € | |
| Stockage | 10 % | 5 € | |
| Écrans | 10 % | 10 € | Marché très comparé |
| Alimentations | 12 % | 6 € | |
| Fauteuils | 15 % | 15 € | Colis volumineux |
| Boîtiers | 18 % | 6 € | Point fort du fournisseur |
| Refroidissement | 20 % | 4 € | Point fort du fournisseur |
| Périphériques | 25 % | 4 € | Achat d'impulsion, peu comparé |
| Accessoires | 30 % | 3 € | Petites pièces, ajoutées au panier |

Les minimums en euros couvrent les frais Stripe (environ 1,5 % + 0,25 € par paiement) et le temps
passé sur une commande, même pour un petit article.

## Le positionnement

Silicium ne gagne pas en étant le moins cher, mais en vendant **des configs qui marchent** :
compatibilité vérifiée, alimentation correctement dimensionnée. La marge se fait sur l'ensemble
de la config (le boîtier, le ventirad, les ventilateurs, les câbles) plutôt que sur la carte
graphique seule.

## Garde-fous automatiques

- Un prix fournisseur **inférieur à 50 % de la médiane du même modèle** est bloqué (exemple réel :
  une RTX 5070 Ti à 129,86 € dans le fichier 1foTrade).
- Une **variation de plus de x2** depuis l'import précédent est bloquée.
- Les produits bloqués restent invisibles tant que personne ne les a vérifiés.

## Offre de lancement (proposition)

- **Livraison offerte dès 99 €** (déjà en place), sans date de fin.
- Pendant le premier mois : **−10 % sur les accessoires et le refroidissement achetés avec une config**
  (au moins un processeur et une carte mère dans le panier). La promotion porte sur les catégories
  à forte marge, et elle pousse vers le panier complet.
- Pas de faux prix barrés : on n'affiche jamais un « ancien prix » qui n'a pas été pratiqué.

## À tester avec de vrais clients

1. **Cartes graphiques à 6 % ou à 4 %** pendant deux semaines chacune, en mesurant le taux d'ajout
   au panier et la marge totale par commande.
2. **Livraison offerte dès 99 € ou dès 149 €** : le seuil de 99 € coûte cher sur les petits paniers.

## Points à vérifier

- Les prix du fichier 1foTrade sont-ils bien **HT** ? (si non : passer `prices_include_vat` à `true`)
- Le **coût de l'expédition directe** au client par 1foTrade : il n'est pas encore compté dans les prix.
- Le **seuil de franchise de TVA** : avec des cartes graphiques à 600 €, le chiffre d'affaires
  monte vite. Au-delà du seuil (il a évolué récemment, à vérifier auprès de l'URSSAF ou d'un
  comptable), il faudra facturer la TVA et passer `NEXT_PUBLIC_VAT_MODE=assujetti`.
