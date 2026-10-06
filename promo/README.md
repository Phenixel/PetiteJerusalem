# Vidéos promotionnelles

Des vidéos verticales courtes (1080×1920, 23 secondes) pour faire connaître
l'app native sur TikTok, Instagram Reels, YouTube Shorts et les statuts
WhatsApp. Chacune montre une seule partie de l'app, puis « Mais aussi… » et
huit autres, une par temps, avant le carton de fin.

| Vidéo             | Ce qu'elle montre                                                     | Habillage          |
| ----------------- | --------------------------------------------------------------------- | ------------------ |
| `horaires`        | l'ouverture en cercle, le rappel posé d'un glissé, la notification     | coucher de soleil  |
| `partage`         | une chaîne de Tehilim, trois psaumes réservés, le QR code, le siyoum   | océan              |
| `bibliotheque`    | les livres, l'hébreu, la phonétique, le défilement seul, hors ligne    | émeraude           |
| `sidour`          | Cha'harit et son horaire, le menu, la boussole du Kotel, le parchemin  | coucher, sombre    |
| `calendrier`      | les fêtes, 'Hanoukah, ses propres dates, le convertisseur              | océan, sombre      |
| `lecture-du-jour` | la carte de l'accueil, la liste, le rappel, le jour coché              | émeraude           |

Rien n'y est inventé : chaque écran est une capture de l'app elle-même,
lancée en mode « app native » sur des données de démo, et chaque geste
(glisser une ligne d'horaire, cocher un psaume, tourner la boussole) y a été
joué pour de vrai, image par image.

## La chaîne

1. **Captures** (`npm run captures`) : `scripts/demo-server.mjs` démarre les
   émulateurs Firebase, crée le compte et les données de démo (les mêmes que
   les captures des stores, plus des dates personnelles) et lance Vite ;
   `scripts/captures.mjs` ouvre l'app dans Chromium, plateforme Capacitor
   « maison » comme `scripts/store-screenshots.mjs`, et joue les plans de
   `scripts/shots.mjs`. Sortie : `public/captures/*.jpg` (non versionnées) et
   `public/captures/marks.json` (versionné), les zones repérées à l'écran
   (un bouton, une carte) où le montage pose un doigt ou un zoom.
2. **Musiques** (`npm run music`) : `scripts/music-engine.js` compose chaque
   piste dans Chromium, en Web Audio hors ligne avec Tone.js. Aucun
   échantillon ni morceau sous licence : une pop électronique en gamme
   freygish, une darbouka en maqsoum, des cordes pincées façon kanoun, et
   les bruitages (souffles, appuis, impacts) posés sur les gestes de l'image.
   Normalisée à -14 LUFS, le niveau des réseaux. Sortie :
   `public/music/<id>.wav` (non versionnées).
3. **Rendu** (`npm run render`) : Remotion rend chaque composition en H.264
   et AAC dans `out/<id>.mp4` (non versionnées). Compose d'abord les
   musiques qui manquent.

`npm run studio` ouvre le studio Remotion, pour revoir une vidéo image par
image et régler un temps.

```bash
cd promo
npm ci
npm run captures   # 2 à 3 minutes, émulateurs compris
npm run render     # 5 à 6 minutes pour les six
```

Prérequis : ceux de `npm run store:screenshots` (CLI firebase, JDK 21), les
ports 8470, 8471 et 5274 libres, `npm ci` fait à la racine. En session
cloud, `PROMO_CHROMIUM` désigne le Chromium de Playwright
(`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` pour les captures et
la musique, `…/chromium_headless_shell-1194/chrome-linux/headless_shell`
pour le rendu) au lieu d'en télécharger un.

## Le montage

Tout se cale sur une grille musicale de 120 temps par minute, à 30 images
par seconde : un temps dure 15 images. `src/timeline.ts` la définit,
`src/videos.ts` la remplit pour chaque vidéo, et la même grille sert à
l'image et au son :

| Section   | Temps | Ce qui s'y passe                                          |
| --------- | ----- | --------------------------------------------------------- |
| `hook`    | 4     | la question ou la promesse, une ligne frappée par temps   |
| `feature` | 24    | la fonctionnalité, au téléphone                           |
| `break`   | 2     | la musique se coupe, « Mais aussi… » tombe sur le noir    |
| `montage` | 8     | huit autres fonctionnalités, un temps chacune             |
| `end`     | 6     | le logo se monte, « Gratuit, sans publicité », les stores |

Les gestes d'une scène sont des **temps marqués** (`marks` dans
`src/videos.ts`) : la scène (`src/scenes/*.tsx`) y place un appui, une coupe,
une carte qui sort de l'écran ; la musique y pose le bruitage nommé à côté.
Déplacer un geste, c'est changer un nombre, et l'image comme le son suivent.

Pour ajouter une vidéo : une entrée dans `VIDEOS` (`src/videos.ts`), une
scène dans `src/scenes`, son accroche dans `src/Root.tsx`, et les plans
qui lui manquent dans `scripts/shots.mjs`.

## L'apparence

Les vidéos suivent `docs/design.md` (section « Les vidéos
promotionnelles ») : les couleurs des trois thèmes, le beige de la pierre et
le gris nuit, Playfair Display pour les titres et Manrope pour le reste
(embarquées depuis Fontsource, aucune requête réseau au rendu), des aplats
et jamais de dégradé, les espaces insécables du français.

## Licences

- **Remotion** est gratuit pour un particulier ou une entreprise de trois
  personnes au plus, ce qu'est Phenixel ; au-delà, une licence d'entreprise
  est due (<https://www.remotion.dev/license>).
- **Tone.js** (MIT), **Playfair Display** et **Manrope** (SIL OFL).
- La musique est composée par le script : elle appartient au projet, sans
  droits à reverser, et ne correspond à aucun morceau qu'une détection de
  droits des réseaux pourrait reconnaître.
