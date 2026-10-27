# Vente au Cameroun

Le site vend en France (euros) et au Cameroun (francs CFA). Le pays est deviné à la première visite
(géolocalisation Netlify, puis langue du navigateur) et le visiteur peut changer avec le sélecteur
« France € / Cameroun FCFA » en haut de page (cookie `marche`).

## Comment est calculé le prix en FCFA

Prix **livré, tout compris** (décision : la douane est incluse, le client ne paie rien à l'arrivée) :

```
valeur CAF  = prix France + fret (poids × tarif au kg + manutention) + assurance
droits      = CAF × (droits de douane + autres taxes)
TVA         = (CAF + droits) × 19,25 %
prix FCFA   = (CAF + droits + TVA + honoraires de dédouanement) × (1 + marge de sécurité) × 655,957
              arrondi aux 500 FCFA supérieurs
```

La livraison à domicile est ajoutée **au panier**, selon la ville (`cm_delivery_zones`).

Un produit dont le fret dépasse **la moitié de sa valeur** n'est pas proposé au Cameroun (grands
boîtiers, grands écrans, fauteuils) : il reviendrait 2 à 4 fois son prix par avion.

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
