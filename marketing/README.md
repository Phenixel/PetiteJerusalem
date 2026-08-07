# Affiches Petite Jérusalem

Supports de communication pour promouvoir le site et l'application : affiches
**imprimables** (A4, panneau de synagogue) et **partageables** (carré 1080×1080,
WhatsApp).

## Ce qu'il y a dans `out/`

| Fichier                            | Format      | Usage                             |
| ---------------------------------- | ----------- | --------------------------------- |
| `affiche-generale-A4.pdf`          | A4          | À imprimer et afficher            |
| `affiche-generale-A4.png`          | 1588×2246   | Aperçu, ou impression photo       |
| `affiche-generale-whatsapp.png`    | 1080×1080   | À partager sur WhatsApp           |
| `affiche-horaires-A4.pdf`          | A4          | À imprimer et afficher            |
| `affiche-horaires-A4.png`          | 1588×2246   | Aperçu, ou impression photo       |
| `affiche-horaires-whatsapp.png`    | 1080×1080   | À partager sur WhatsApp           |

**Affiche générale** : présente la plateforme dans son ensemble (partage de
lectures, bibliothèque, horaires, chiourim, lecture du jour). C'est l'affiche
passe-partout. Son QR mène à `petite-jerusalem.fr`.

**Affiche horaires** : angle utilitaire quotidien (zmanim, chnei mikra, lecture
quotidienne, rappel). C'est celle qui fait installer l'application. Son QR mène
directement à `petite-jerusalem.fr/horaires`.

## Modifier une affiche

Les affiches sont des fichiers HTML : ouvrez-les dans un navigateur pour les
voir, éditez le texte, relancez le rendu.

```bash
node marketing/render.mjs            # tout
node marketing/render.mjs horaires   # seulement les affiches « horaires »
```

Le rendu a besoin de Playwright et de Chromium :

```bash
npm install --no-save playwright && npx playwright install chromium
```

`affiches/poster.css` porte toute la mise en forme, commune aux quatre affiches.
Tout y est dimensionné en `em` : chaque format ne fixe que sa `font-size`
racine (`.sheet--a4`, `.sheet--square`) et l'affiche entière suit. Si un texte
allongé fait déborder une affiche, baissez cette valeur d'un dixième plutôt que
de retoucher les composants un par un.

⚠️ **Vérifiez toujours le bas de page après un rendu.** Un débordement se voit
sur le PNG, mais un texte qui dépasse est simplement rogné, sans erreur.

## QR codes

Générés par `build-qr.mjs` à partir de la librairie déjà utilisée par le site
(`public/vendor/qrcode-generator.js`), en correction d'erreur `H` : l'affiche
reste scannable même froissée, punaisée ou photographiée de travers.

Les SVG produits sont commités. À relancer uniquement si une URL change :

```bash
node marketing/build-qr.mjs
```

**Avant toute impression**, revérifiez que les QR sont lisibles dans les images
finales — c'est le seul contrôle qui compte, il décode les PNG rendus et pas les
SVG source :

```bash
npm install --no-save jsqr pngjs && node marketing/verify-qr.mjs
```

## Polices

`fonts/Inter.woff2` et `fonts/Lora.woff2` (SIL Open Font License) sont les
polices de la charte du site. Ce sont des fichiers *variables* : un seul fichier
couvre toutes les graisses. Ils sont commités pour que le rendu soit identique
partout, sans dépendance réseau.

---

# Prompts pour générateur d'image

## Pourquoi les affiches ne sont pas générées par IA

Les quatre affiches ci-dessus sont faites en HTML/CSS, pas par un générateur
d'image, pour trois raisons qui comptent sur un support imprimé :

1. **Le texte est net et exact.** Les générateurs d'image déforment encore le
   français accentué, et massacrent l'hébreu.
2. **Le QR code fonctionne.** Un QR « dessiné » par une IA n'est jamais
   scannable — c'est un motif qui y ressemble.
3. **On peut corriger une virgule** sans tout regénérer.

Les prompts ci-dessous servent donc à produire des **visuels d'accompagnement**,
pas les affiches elles-mêmes.

## 1. Illustration d'en-tête (à glisser dans une affiche)

> Illustration vectorielle épurée, style plat et moderne, sans texte ni
> lettrage. Les remparts de la vieille ville de Jérusalem stylisés — une tour
> crénelée, une muraille en pierres appareillées, deux cyprès, un dôme — en
> ocre doré (#c9a227), posés au-dessus d'un livre ouvert stylisé en bleu roi
> (#1d6fdb) dont les pages dessinent des lignes courbes. Fond beige chaud et
> uni (#f4f1ea). Formes géométriques simples, aplats de couleur sans dégradé,
> contours nets, symétrie douce. Aucune personne, aucun visage, aucun texte,
> aucun caractère d'écriture. Composition horizontale, large marge autour du
> sujet. Style d'icône d'application, sobre et intemporel.

Négatif : `texte, lettres, mots, calligraphie, visages, personnes, photoréalisme, dégradés, ombres portées, filigrane`

## 2. Fond décoratif discret (motif de page)

> Motif géométrique répétable très discret, inspiré des pavages de pierre de
> Jérusalem et des étoiles à six branches, en traits fins ocre doré (#c9a227)
> à 10 % d'opacité sur fond beige uni (#f4f1ea). Extrêmement léger, presque
> imperceptible, destiné à passer derrière du texte sans nuire à la lisibilité.
> Aucun texte, aucun symbole religieux figuratif, aucune zone sombre.

Négatif : `texte, contraste fort, couleurs vives, motifs chargés, dégradés`

## 3. Visuel de partage réseaux sociaux (bannière 1200×630)

> Bannière horizontale sobre, fond beige chaud uni (#f4f1ea), large espace vide
> à gauche réservé pour du texte ajouté plus tard. À droite, une illustration
> vectorielle plate : un livre ouvert bleu roi (#1d6fdb) d'où s'élèvent
> quelques traits dorés (#c9a227) suggérant le partage entre plusieurs mains,
> sans représenter de personnes. Aplats de couleur, contours nets, aucun texte.

Négatif : `texte, lettres, personnes, visages, photoréalisme, logos existants`

## Comment s'en servir

1. Générez l'image, puis placez-la dans `marketing/affiches/`.
2. Référencez-la dans l'affiche voulue, par exemple juste après `<header class="brand">` :
   `<img class="hero" src="mon-illustration.png" alt="" />`
3. Ajoutez sa taille dans `poster.css` (par exemple `.hero { width: 100%; margin-top: 1.2em }`).
4. Relancez `node marketing/render.mjs` et **revérifiez le bas de page** :
   ajouter une image pousse le contenu vers le bas et peut faire déborder
   l'affiche.

⚠️ Le style retenu pour ces affiches est volontairement sobre. Une illustration
ajoute de la chaleur mais mange de la place : sur l'A4, il faudra probablement
retirer une fonctionnalité de la liste pour lui faire de la place.

## Rappel sur les badges de store

La ligne « Disponible sur Google Play » utilise un pictogramme maison, pas le
badge officiel : celui de Google est soumis à des règles d'usage précises
(proportions, zone de protection, pas de recoloration). Si vous voulez le badge
officiel, téléchargez-le depuis le Google Play Brand Toolkit et remplacez le
bloc `.stores` — sans le recolorer.
