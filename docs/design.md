# Charte graphique

Ce document est la référence de l'apparence du site et de l'app. Il dit ce
qu'on emploie, et surtout ce qu'on n'emploie plus. Toute nouvelle page s'y
range ; toute exception se discute et s'écrit ici.

Le fil conducteur tient en une image : la pierre de Jérusalem. Des surfaces
franches, chaudes, posées à plat ; des couleurs pleines qui accrochent l'oeil
là où il faut agir ; rien de vaporeux.

## 1. Le fond, les surfaces

| Rôle | Jeton | Clair | Sombre |
| --- | --- | --- | --- |
| Fond de page | `--color-bg-beige` | `#f4f1ea` | `#111827` |
| Surface (carte, panneau, fenêtre) | `--color-surface` | `#ffffff` | `#1f2937` |
| Surface douce | `--color-surface-soft` | `#f8f5ef` | `#273244` |
| Texte | `--color-text-primary` | `#35312a` | `#f3f4f6` |
| Texte secondaire | `--color-text-secondary` | `#6d6759` | `#9ca3af` |
| Filet | `--color-line` | noir à 8 % | blanc à 10 % |

Une surface se détache du fond par son ombre, jamais par une bordure. Les
trois ombres (`--shadow-card`, `--shadow-card-hover`, `--shadow-pop`) sont
teintées chaud pour rester dans la famille du beige.

## 2. Les couleurs de thème

Trois duos au choix, dans cet ordre. Le premier est celui d'origine.

| Thème | `primary` | `secondary` |
| --- | --- | --- |
| sunset (défaut) | `#DE4F17` | `#C98A00` |
| ocean | `#1E6BF0` | `#0891B2` |
| emerald | `#059C66` | `#0D9488` |

Ils vivent dans `src/composables/useTheme.ts`, qui réécrit `--color-primary`
et `--color-secondary` sur la racine ; le CSS ne connaît que les deux
variables. L'accent des widgets natifs suit le même choix, et sa valeur de
repli (`DEFAULT_ACCENT` dans `widgetPayloads.ts`, les constantes
`FALLBACK_ACCENT` côté natif) est celle du thème par défaut : les trois se
changent ensemble.

Ce que fait `primary` : les boutons pleins, les liens, les numéros de verset,
l'onglet actif, le bandeau du profil, les illustrations. Ce que fait
`secondary` : les puces d'une seconde catégorie et les traits d'accent des
illustrations. Il ne sert plus à faire un dégradé avec `primary`.

**Pas de dégradé.** Nulle part : ni sur un fond, ni sur un texte
(`bg-clip-text`), ni sur une vignette de partage. Une couleur pleine ressort
mieux qu'un fondu, et deux couleurs fondues en donnent une troisième qui
n'existe nulle part ailleurs dans l'app. Quand il faut montrer les deux
couleurs d'un duo (l'aperçu des thèmes dans les réglages), on les pose côte à
côte, à plat.

Deux couleurs échappent au thème, parce qu'elles disent un état et non un
goût : le danger (rouge, `.btn-danger`) et l'échéance qui approche (ambre).
Elles ne bougent pas quand on change de thème.

### Lisibilité

`primary` sert à la fois de fond sous du blanc et d'encre sur le beige. Les
trois valeurs sont donc prises assez soutenues pour tenir dans les deux sens
(entre 3,1 et 4,2 de contraste sur le beige, entre 3,5 et 4,8 sur le blanc).
Une couleur plus vive que celles-ci ne passerait plus en texte : si le besoin
vient, on ajoutera un jeton d'encre distinct du jeton de fond plutôt que
d'éclaircir `primary`.

## 3. Les rayons

Deux familles, et elles vont en sens contraire. Les **surfaces** sont taillées
franc, comme la pierre, à peine adoucies aux angles ; les **commandes** sont
nettement rondes, pour se donner à toucher. C'est le contraste entre les deux
qui fait lire un bouton comme un bouton.

| Jeton | Valeur | Pour |
| --- | --- | --- |
| `--radius-card` (`rounded-card`) | 6 px | cartes, panneaux, listes, tuiles, squelettes |
| `--radius-control` (`rounded-control`) | 10 px | petites commandes : bouton d'icône, champ, bouton d'un groupe segmenté |
| `--radius-btn` (`rounded-btn`) | 14 px | boutons, coques de groupes segmentés, lignes de menu |
| `--radius-pill` (`rounded-pill`) | 999 px | puces, pastilles, curseurs |
| `--radius-xs` … `--radius-3xl` | 2, 3, 4, 6, 8, 10, 14 px | l'échelle Tailwind, réglée sur la famille des surfaces |

L'échelle numérique ne sert qu'aux surfaces : `rounded-lg` vaut 6 px, comme
`.card` (c'est la valeur par défaut d'une surface), `rounded-xl` 8 px pour les
fenêtres et les panneaux flottants, `rounded-sm` 3 px pour un aperçu posé dans
une carte. Les commandes ne suivent pas cette échelle : elles prennent leurs
alias. Un élément posé dans un autre prend le rayon du parent moins son
rembourrage (une coque à 14 px avec 2 px de marge intérieure tient un bouton à
12 px, arrondi ici à `rounded-control`).

## 4. Les polices

Deux familles portent toute l'interface, et elles ne se règlent pas : ce sont
elles, l'identité du site.

| Jeton | Famille | Pour |
| --- | --- | --- |
| `--font-display` (`font-display`) | Playfair Display | le titre de page (`h1`, d'office) et le peu qu'on met vraiment en avant |
| `--font-sans` (`font-sans`) | Manrope | tout le reste : textes, boutons, étiquettes, chiffres |
| `--font-hebrew` | au choix | le texte hébreu d'une lecture |
| `--font-reading` | au choix | le texte latin d'une lecture (traduction, phonétique, didascalies) |
| `--font-serif` | Lora, Georgia en repli | les tranches des livres de la bibliothèque et la dédicace |

Playfair est une police d'apparat : posée partout, elle ne met plus rien en
avant. Elle est automatique sur les `h1` et se pose à la main (classe
`font-display`) ailleurs : le nom du site, le titre d'une page qui n'est pas
un `h1`, une accroche, un grand chiffre. Aux gros corps, on l'accompagne de
`tracking-tight`.

### Les polices au choix ne valent que pour la lecture

Changer de police dans les réglages, c'est régler son confort de lecture,
comme on règle la taille du texte. Cela ne repeint plus l'application : le
choix latin s'applique à `--font-reading`, employé par les classes du texte
d'une lecture (`.reading-tl`, `.daily-tl`, `.daf-tl`, les didascalies, le
`.tl` des pages prérendues), et le choix hébreu à `--font-hebrew`. Aucun des
deux ne touche `--font-sans` ni `--font-display`.

Les options latines sont Manrope (celle de la maison, par défaut), Lora et
Nunito. Seules les polices de l'identité bloquent le premier rendu
(`index.html`) ; les autres sont injectées à la demande par `useFonts.ts`.

## 5. Le bandeau de navigation

Sur le **web**, le bandeau est transparent tant qu'on est en tête de page : il
laisse voir le beige et ne pèse rien. Dès le premier geste de défilement, il
prend un fond translucide et flouté, sans quoi le contenu se lirait à travers
les liens. Sur **mobile**, il est compact : le titre passe au corps courant,
la baseline disparaît, les marges verticales sont réduites de moitié. Le
bandeau publie sa hauteur réelle dans `--navbar-height`, dont dépendent les
barres collantes des pages.

L'app native n'a pas de bandeau : la navigation y passe par la barre du bas
(`BottomTabBar`).

## 6. Ce qu'on n'emploie pas

- Les dégradés, sous toutes leurs formes.
- Les bordures pour détacher une carte du fond : c'est le rôle de l'ombre.
- Les majuscules d'imprimerie et l'interlettrage élargi sur les étiquettes.
- Playfair sur autre chose qu'un titre ou une mise en avant.
- Une couleur codée en dur là où un jeton existe.

## 7. Ce qui reste à faire

Cette charte est en cours d'écriture, au fil des décisions.

- Un jeton d'encre distinct de `--color-primary`, si l'on veut des couleurs
  plus vives sans perdre les liens et les numéros de verset.
- L'icône de l'app porte encore le bleu d'avant : elle se reprendra plus tard.
  Les captures des fiches des stores se régénèrent à la prochaine CI.
