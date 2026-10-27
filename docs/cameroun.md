# Vente au Cameroun

Le site vend en France (euros) et au Cameroun (francs CFA). Le pays est deviné à la première visite
(géolocalisation Netlify, puis langue du navigateur) et le visiteur peut changer avec le sélecteur
« France € / Cameroun FCFA » en haut de page (cookie `marche`).

## Comment est calculé le prix en FCFA

Prix **livré, tout compris** (décision : la douane est incluse, le client ne paie rien à l'arrivée) :

```
valeur CAF  = prix France hors TVA française + fret (poids × tarif au kg + manutention) + assurance
droits      = CAF × (droits de douane + autres taxes)
TVA         = (CAF + droits) × 19,25 %
prix FCFA   = (CAF + droits + TVA + honoraires de dédouanement) × (1 + marge de sécurité) × 655,957
              arrondi aux 500 FCFA supérieurs
```

La livraison à domicile est ajoutée **au panier**, selon la ville (`cm_delivery_zones`).

Aucun produit n'est exclu : tous ont un prix livré. Attention, par avion, les produits volumineux
reviennent très cher (un boîtier à 62 € coûte environ 142 500 FCFA livré, un fauteuil plus de
230 000 FCFA). Le tri se fera avec le transitaire (fret maritime pour les gros volumes ?).

## TVA française

Les marchandises exportées hors de l'Union européenne sont exonérées de TVA française : la valeur de
base est donc le prix France **hors TVA** (`private.cm_params.goods_without_fr_vat = true`).

**Confirmé le 27 octobre 2026 avec 1foTrade** : les produits expédiés au Cameroun sont achetés
hors TVA (pas de 20 % payés à 1foTrade). Le justificatif
d'exportation sera fourni par le transitaire, à conserver pour chaque envoi.

Rappel du cadre : En franchise de base (micro-entreprise non
assujettie), vous payez la TVA sur vos achats sans pouvoir la récupérer. Acheter **sans TVA** des
produits destinés à l'export passe en principe par le régime des achats en franchise (article 275
du CGI), réservé aux exportateurs assujettis et soumis à justificatifs d'exportation. Si vous ne
pouvez pas acheter hors taxe, remettre l'interrupteur à `false` : les prix FCFA incluront alors la
TVA française payée à 1foTrade, sinon chaque vente au Cameroun vous coûterait ces 20 %.

## Paramètres à confirmer avec vos prestataires

Tous dans Supabase. Après une modification, lancer `select private.compute_cm_prices();`.

| Paramètre | Table | Valeur provisoire | Qui la fournit |
|---|---|---|---|
| Fret aérien Paris → Douala | `private.cm_params.freight_eur_per_kg` | 9,00 €/kg | Transitaire |
| Manutention par article | `handling_eur_per_item` | 3,00 € | Transitaire |
| Assurance | `insurance_pct` | 1 % | Transitaire |
| Honoraires de dédouanement | `clearance_eur_per_item` | 4,00 € | Transitaire |
| Droits de douane | `duty_pct` | 10 % | Transitaire (selon code SH) |
| Autres taxes (TCI, redevance…) | `other_taxes_pct` | 2,5 % | Transitaire |
| TVA Cameroun | `vat_pct` | 19,25 % | Loi de finances |
| Marge de sécurité | `risk_pct` | 3 % | Vous |
| Délai transport + douane | `transit_days_min/max` | 10 à 21 jours ouvrés | Transitaire |
| Poids par type de produit | `private.cm_weights` | voir la table | À ajuster sur facture |
| Villes et tarifs de livraison | `public.cm_delivery_zones` | Douala 2 000, Yaoundé 3 500 FCFA | Livreur local |

Questions à poser au **transitaire** : tarif au kg (et poids volumétrique), frais fixes par colis,
assurance, délai, et s'il dédouane en votre nom (DDP) avec une facture détaillée des droits payés.

Questions au **livreur** : villes couvertes, tarif par ville, délai, et s'il peut encaisser à la
livraison en cas de besoin.

## Paiement (à faire)

Sans structure au Cameroun, il faut un agrégateur qui accepte Orange Money et MTN MoMo pour un
marchand étranger et reverse sur un compte en euros. À vérifier fournisseur par fournisseur
(CamerPay, Flutterwave, Boldrails…) : acceptation d'une micro-entreprise française, frais, délai et
devise de reversement. Le site est prêt à recevoir l'intégration dès le compte ouvert.
