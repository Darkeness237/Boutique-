# Plan marketing Silicium : se faire connaître et vendre

Objectif des 90 premiers jours : **premières ventes rentables en France, premiers clients au Cameroun**, avec
un budget publicitaire maîtrisé (300 à 600 € par mois au départ), en mesurant chaque euro dépensé.

Principe : sur des composants PC, la marge est faible (6 à 10 % sur processeurs et cartes graphiques). La
publicité payante doit donc viser **les produits à forte marge** (refroidissement, boîtiers, périphériques,
accessoires, fauteuils : 15 à 30 %) et **les paniers complets** (config du moment). Les cartes graphiques
attirent du trafic, mais rapportent peu : elles se vendent par le référencement gratuit, pas par la pub.

---

## 1. Ce qui est déjà en place dans le site

| Élément | Où | À quoi ça sert |
|---|---|---|
| Plan du site | `/sitemap.xml` | Google découvre les 9 700 fiches produits |
| robots.txt | `/robots.txt` | Indique à Google quoi explorer (pas le panier ni le compte) |
| Données structurées produit | chaque fiche | Prix, stock, livraison et retours affichés directement dans Google |
| Aperçu réseaux sociaux (Open Graph) | chaque fiche | Belle carte avec photo quand on partage un lien sur WhatsApp, Facebook, X |
| Flux Google Shopping | `/flux/google-shopping.xml` | 1 386 produits en stock avec photo, EAN, promos et frais de port |
| Inscription avec Google + adresse | `/inscription` | Moins de friction, adresse prête pour la commande |
| Consentement newsletter (RGPD) | profil client | Liste e-mail légale, avec date du consentement |

## 2. Gratuit, à faire en premier (semaine 1)

1. **Google Search Console** : ajouter le site, valider avec la variable Netlify
   `GOOGLE_SITE_VERIFICATION` (le code « content » de la balise meta), puis soumettre `/sitemap.xml`.
2. **Google Merchant Center** : créer le compte, renseigner l'entreprise (SIRET, adresse, CGV, retours),
   puis ajouter le flux `https://<domaine>/flux/google-shopping.xml` en récupération quotidienne.
   Résultat : **annonces gratuites dans l'onglet Shopping** de Google. C'est le canal n°1 pour les
   composants PC, où les acheteurs comparent les prix.
3. **Bing Webmaster Tools** : importer depuis Search Console (5 minutes), variable `BING_SITE_VERIFICATION`.
4. **Google Business Profile** : fiche « magasin en ligne » (zone desservie France + Douala/Yaoundé).
5. **Comparateurs de prix** : Idealo, LeDénicheur, Touslesprix (le même flux peut leur être adapté).
6. **Nom de domaine** : acheter `silicium.fr` ou équivalent (environ 10 €/an). Indispensable avant
   toute publicité : une adresse en `netlify.app` inspire peu confiance.

## 3. Publicité payante (à partir du mois 2, une fois les ventes test validées)

| Canal | Budget de départ | Cible | Mesure |
|---|---|---|---|
| **Google Ads – Performance Max Shopping** | 10 €/jour | France, produits à marge ≥ 15 % (étiquette personnalisée dans le flux) | ROAS cible ≥ 400 % |
| **Google Ads – Recherche** | 5 €/jour | Mots clés précis : « boîtier PC pas cher », « config PC gamer compatible », « watercooling 360 » | Coût par vente |
| **Meta (Facebook + Instagram)** | 5 €/jour | Reciblage des visiteurs + catalogue dynamique (même flux) | Ventes attribuées |
| **TikTok Ads** | plus tard | Jeunes joueurs, vidéos « je monte ma config » | Visites, ajouts au panier |

Règles :
- Ne jamais lancer de publicité sans **suivi des conversions** (voir §6).
- Couper un produit ou un mot clé dès que la pub coûte plus que la marge réalisée.
- Les promotions du site (refroidissement −10 %, boîtiers −8 %, périphériques −12 %) sont les meilleurs
  sujets de pub : le prix barré est légal (prix le plus bas des 30 derniers jours) et visible dans Google.

## 4. Cameroun : bouche-à-oreille et messagerie

Au Cameroun, la vente passe par **WhatsApp et Facebook**, et par la confiance.

1. **WhatsApp Business** : numéro dédié, catalogue des 30 meilleures ventes, réponses rapides,
   bouton « Commander sur WhatsApp » à ajouter sur le site (je peux le faire).
2. **Page Facebook + groupes** : rejoindre les groupes gamers, informatique et étudiants de Douala et
   Yaoundé (à repérer par une recherche Facebook, en respectant les règles de chaque groupe). Publier des configs avec le prix
   livré en FCFA tout compris : c'est l'argument décisif face aux revendeurs locaux.
3. **Publicité Facebook ciblée** Douala + Yaoundé : 2 000 à 5 000 FCFA/jour, vidéos courtes
   « colis reçu, déballage ». Coût par clic très bas.
4. **Ambassadeurs** : 3 ou 4 influenceurs gaming locaux (TikTok, Facebook), un code promo chacun,
   commission de 3 à 5 % sur les ventes.
5. **Preuves de livraison** : photos de clients avec leur colis (avec accord), publiées chaque semaine.

## 5. Contenu et réseaux sociaux (France et Cameroun)

Trois piliers, deux à trois publications par semaine :
- **Config du moment** : la config compatible du site, son prix, ce qu'elle fait tourner (jeux, FPS).
- **Bons plans** : les promotions de la semaine, en vidéo courte (TikTok, Reels, Shorts).
- **Pédagogie** : « quelle alimentation pour une RTX 5070 ? », « DDR4 ou DDR5 ? », « AM5 ou LGA1700 ? ».
  Ces sujets deviennent aussi des articles de blog pour le référencement (je peux créer la section blog).

Communautés : Reddit r/buildapc_fr, forums Hardware.fr et Les Numériques (participer et aider,
sans spam), serveurs Discord gaming.

## 6. Mesure (indispensable avant la publicité)

À mettre en place (je peux le coder) :
- **Bannière de consentement cookies** conforme CNIL : obligatoire avant tout pixel publicitaire.
- **Google Ads / GA4 + pixel Meta**, chargés seulement après consentement, avec l'événement
  « achat » envoyé depuis la page de confirmation de commande.
- **Liens suivis** (UTM) sur chaque publication et chaque lien en bio.

Indicateurs à suivre chaque semaine : visites, taux de conversion (objectif 1 à 2 %), panier moyen,
coût d'acquisition par vente, marge après publicité.

## 7. Fidélisation (e-mail)

- E-mail de bienvenue avec un avantage (livraison offerte sur la première commande, par exemple).
- Newsletter hebdomadaire des bons plans, uniquement aux clients ayant coché la case (consentement daté).
- Relance de panier abandonné (clients connectés) et demande d'avis 10 jours après la livraison.
- Outil conseillé : **Brevo** (français, gratuit jusqu'à 300 e-mails par jour). Il servira aussi à envoyer
  les e-mails de création de compte (voir ci-dessous).

## 8. Calendrier

| Semaine | Actions |
|---|---|
| 1 | Domaine, Search Console, Merchant Center, Bing, Google Business, WhatsApp Business, page Facebook |
| 2 | Bannière cookies + suivi des conversions, premiers contenus, comparateurs de prix |
| 3-4 | Première campagne Performance Max (10 €/jour), Facebook Cameroun (3 000 FCFA/jour) |
| 5-8 | Ajuster selon le ROAS, ambassadeurs Cameroun, e-mails automatiques |
| 9-12 | Black Friday / Noël : offres préparées 3 semaines avant, budget doublé seulement si ROAS ≥ 400 % |

Le Black Friday (27 novembre 2026) et Noël arrivent vite : c'est le pic de l'année pour le matériel PC.
