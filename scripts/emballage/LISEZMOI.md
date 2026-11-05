# Photo de l'emballage d'origine en 2e position

Icecat ne dit pas quelle photo de la galerie montre le carton. Un modèle de vision seul se trompe trop souvent
(il confond un boîtier PC ou une alimentation avec un carton), donc on procède en deux temps :

1. `1-classer.mjs` : pour chaque produit en stock pas encore vérifié, le modèle CLIP (local, gratuit) choisit la photo
   qui ressemble le plus à un emballage. Résultat : un fichier `candidats.jsonl`.
   ```
   npm i --no-save @huggingface/transformers@3.7.5
   node --env-file=.env.local --env-file=import.env scripts/emballage/1-classer.mjs candidats.jsonl
   ```
2. `2-planches.py` : planches de 48 vignettes numérotées, à vérifier à l'œil (`python3 2-planches.py candidats.jsonl planches 0 500`).
   Noter dans `valides.txt` les numéros qui montrent vraiment le carton (face avant ; les dos d'emballage couverts
   de texte sont écartés).
3. `3-appliquer.mjs` : la photo validée passe juste après la photo principale ; tous les produits du lot sont marqués
   comme vérifiés (`packaging_checked_at`). `node ... 3-appliquer.mjs candidats.jsonl valides.txt 0 500`

Les images parasites connues (QR code de garantie, dos d'emballage) sont listées dans `JUNK` (3-appliquer.mjs et
scripts/galerie-icecat.mjs).
