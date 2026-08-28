# Captures d'écran App Store

Régénérées et envoyées automatiquement à chaque tag par le job `screenshots`
de `.github/workflows/deploy-ios.yml` : `npm run store:screenshots -- --ios`
produit les fichiers ici (`fr-FR/iphone-*.jpg`, `fr-FR/ipad-*.jpg`), puis
`scripts/asc-screenshots.mjs` les envoie dans App Store Connect (l'API impose
un envoi en morceaux avec somme de contrôle, le script s'en charge).

Rien à committer ici : la CI régénère toujours ses propres fichiers avant
l'envoi. Un jeu déposé à la main sous `<locale>/` sert pour un envoi manuel
(`node scripts/asc-screenshots.mjs --version X.Y.Z`), par exemple pour
reprendre la main avec des captures faites au simulateur iOS (`⌘S`).

**Format** : l'app est universelle, donc deux séries par langue (`fr-FR/`,
`en-US/`, `he/` ; une langue sans dossier laisse sa fiche intacte).

| Famille | Fichiers | Dimensions | Équivalent simulateur |
|---|---|---|---|
| iPhone 6,9" | `iphone-*.jpg` | 1320 × 2868 | iPhone 17 Pro Max |
| iPad 13" | `ipad-*.jpg` | 2064 × 2752 | iPad Pro 13" |

PNG ou JPEG sRGB **sans canal alpha** (le script produit du JPEG pour cette
raison), envoyés triés par nom. Apple redimensionne pour les appareils plus
petits de chaque famille.

**Écrans** (mêmes que la fiche Play Store, voir
`scripts/store-screenshots.mjs`) :

1. accueil connecté (tableau de bord)
2. session de partage de lecture
3. bibliothèque
4. lecteur de texte (Tehilim 1)
5. lecture quotidienne
6. détail d'un chiour
7. accueil visiteur
