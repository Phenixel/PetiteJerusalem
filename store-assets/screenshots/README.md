# Captures d'écran des fiches

Un seul jeu de captures pour les deux stores : mêmes écrans, mêmes données de
démo, même rendu de l'app, produits en une fois par
`scripts/store-screenshots.mjs` (`npm run store:screenshots`).

## Où elles servent

| Fichiers | Dimensions | Fiche | Envoyés par |
|---|---|---|---|
| `<locale>/phone-*.jpg` | 1080 × 1920 (360 × 640 CSS @3x) | Play Store, téléphone | `scripts/play-listing.mjs` |
| `<locale>/iphone-*.jpg` | 1320 × 2868 (440 × 956 CSS @3x) | App Store, iPhone 6,9" (`APP_IPHONE_67`) | `scripts/asc-screenshots.mjs` |
| `<locale>/ipad-*.jpg` | 2064 × 2752 (1032 × 1376 CSS @2x) | App Store, iPad 13" (`APP_IPAD_PRO_3GEN_129`) | `scripts/asc-screenshots.mjs` |

Trois formats et non un seul, parce que les deux stores n'acceptent pas les
mêmes proportions : le Play Store refuse une image dont un côté dépasse deux
fois l'autre (le 6,9" d'Apple est à 2,17), et Apple exige ses dimensions au
pixel près. Le contenu, lui, est le même partout.

JPEG sRGB **sans canal alpha** : Apple refuse l'alpha, Google accepte le JPEG.
Envoyés triés par nom ; le jeu d'une famille remplace entièrement celui du
store. Une locale sans dossier laisse sa fiche intacte (le dossier porte le
nom commun aux deux stores, `fr-FR`).

## Écrans

Dans l'ordre des fiches (`SCREENS` dans le script) :

1. accueil connecté (tableau de bord)
2. horaires du jour (Paris)
3. session de partage de lecture
4. lecteur de texte (Tehilim 1)
5. bibliothèque
6. lecture quotidienne
7. détail d'un chiour

Le Play Store en prend huit au plus par format, l'App Store dix : un écran de
plus tient encore, pas deux.

## Rendu

Chrome headless, sur les émulateurs Firebase avec des données de démo fixes
(compte « Sarah Levy », session Tehilim, chiourim). La page se charge avec
une plateforme Capacitor « maison » (`window.CapacitorCustomPlatform`) :
l'app se croit native et montre son interface d'app (barre d'onglets du
bas, pas d'en-tête ni de pied de page de site), ses plugins retombant sur
leur implémentation web. Pas de barre système : ni celle d'Android dans la
fiche App Store, ni l'inverse.

Le compte de démo a les thèmes des fêtes coupés : une fiche générée pendant
une fête en garderait sinon le décor jusqu'au tag suivant.

## En CI

À chaque tag, `.github/workflows/store-screenshots.yml` génère le jeu une fois
et le publie en artifact `store-screenshots`. `deploy-android.yml` (job
`listing`) et `deploy-ios.yml` (job `screenshots`) le récupèrent par l'action
`.github/actions/fetch-store-screenshots`, qui attend la fin du run s'il
tourne encore. Si la génération échoue ou traîne plus de 20 minutes, les
deux fiches partent avec les captures committées ici : la release n'attend
jamais les captures.

Pour régénérer sans rien publier : lancer « Store screenshots » à la main
(onglet Actions), puis télécharger l'artifact du run, à committer ici au
besoin pour rafraîchir le jeu de repli.
