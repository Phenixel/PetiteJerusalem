# Rafraîchir l'interface sans qu'elle ait l'air générée

Septembre 2026. Proposition de mise à jour de l'interface et de l'expérience,
dans l'idée graphique qui est déjà celle du site (la pierre de Jérusalem, le
beige, le mur en lumière derrière la page, l'étagère de sefarim), avec un
objectif de plus : que le rendu ne fasse pas « fait par une IA ». La première
moitié de ce document dit ce qui donne cette impression et pourquoi le site
y prêtait le flanc ; la seconde dit ce qui a été fait sur cette branche et
ce qui reste à faire.

## 1. Ce qui fait « généré par IA », d'après ce qui s'écrit dessus

Le sujet a beaucoup été documenté en 2025 et 2026, par des designers qui
relisent des interfaces produites par des outils de génération de code. Les
mêmes signes reviennent dans toutes les listes, parce que ces outils tirent
tous du même corpus et rendent tous la même « moyenne » :

| Signe | Pourquoi ça trahit |
| --- | --- |
| Inter partout (ou une police par défaut) | Personne ne l'a choisie : c'est ce que l'outil met quand on ne dit rien. Premier signe cité, dans toutes les sources. |
| Texte en dégradé (`bg-clip-text`), dégradé bleu-violet, boutons bleu Tailwind | Le « premium » par réflexe. Le dégradé de deux couleurs voisines dit qu'aucune couleur n'a été choisie. |
| Le gabarit « titre centré, trois cartes jumelles, un bouton » | Le plan par défaut d'une page d'accueil, reconnu au premier coup d'œil. |
| `rounded-2xl` et une ombre sur chaque surface, verre dépoli par réflexe | Tout est rond et flottant, rien n'est hiérarchisé. |
| Icônes de bibliothèque dans des carrés arrondis pastel, une par carte | La même vignette répétée pour chaque fonctionnalité. |
| Petites capitales espacées au-dessus de chaque titre | Le « label » de maquette, posé partout sans raison. |
| Le même `fade-in-up` sur chaque élément, ou aucun mouvement | Un mouvement sans intention ; ou l'inverse, des survols qui ne font rien. |
| Espacements identiques partout (`p-6`, `gap-4`) | Aucun rythme : la page ne respire pas, elle est tramée. |
| Mode sombre gris-bleu de série (`gray-900`) | Le sombre de Tailwind, pas celui du site. |
| Emoji dans l'interface, verbes creux dans les textes | Du remplissage. |

Les sources consultées, pour qui veut aller plus loin : le dépôt
[avoid-ai-design](https://github.com/funboy322/avoid-ai-design) (un audit
de ces motifs, avec ses règles), l'article « AI Design Slop: Why Every
AI-Built Interface Looks the Same » ([Medium, août
2026](https://mohitphogat.medium.com/ai-design-slop-why-every-ai-built-interface-looks-the-same-and-how-to-fix-it-bf874e0b470c)),
« Why Your AI Keeps Building the Same Purple Gradient Website »
([prg.sh](https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website)),
« 7 Signs a UI Has Been Vibe Coded » ([The Fountain
Institute](https://www.thefountaininstitute.com/blog/signs-vibe-coded-ui)),
« AI Design Slop: 16 Patterns That Out Your App as Vibe-Coded »
([Developers
Digest](https://www.developersdigest.tech/blog/ai-design-slop-and-how-to-spot-it)),
et « Your AI-Built Websites Look Identical to Everyone Else's »
([Medium](https://medium.com/@chiragthummar16/your-ai-built-websites-look-identical-to-everyone-elses-these-10-skills-fix-that-046ddf58e4d5)).
La règle qui les résume toutes : chaque réflexe remplacé par un choix.

## 2. Où le site en était

Ce que le site avait déjà de bien, et qu'il faut garder : le beige et le mur
de pierre en lumière (StoneWallBackground, unique en son genre), l'étagère de
livres reliés de la bibliothèque, les illustrations dessinées à la main de
l'accueil, Frank Ruhl Libre pour l'hébreu, des cartes sans bordure, des
ombres teintées de chaud, des puces discrètes. C'est l'idée graphique, on ne
la touche pas.

Ce qui, en revanche, cochait les cases du tableau ci-dessus :

- Inter comme police d'interface, pour tout, titres compris.
- Le nom du site en dégradé bleu vers cyan (`bg-clip-text`), le prénom de
  l'accueil aussi, le bandeau du profil en dégradé plein.
- Le thème « Océan » : un bleu et un cyan voisins, de la palette Tailwind.
- Trois cartes jumelles sous le titre de l'accueil, chacune avec son
  illustration, chacune montée par le même `fade-in-up` décalé ; le titre
  centré sur téléphone.
- Toutes les surfaces à 16 px de rayon avec la même ombre, les boutons et
  les champs à 10 px, les filtres en pastilles pleines.
- Des étiquettes en capitales espacées (« SEFER 1 », « SÉRIE », « AUBE ET
  LEVER ») en tête de pages et de sections.
- Un mode sombre `gray-900` bleuté, étranger à la pierre.
- Un emoji dans le pied de page, un halo coloré sous le bouton rond de la
  barre basse.

## 3. La direction : du papier sur la pierre

Une image pour tenir le tout : la page est une feuille de papier posée sur
le mur de pierre. Le papier est légèrement crème, coupé presque droit,
détaché du mur par son liseré plus que par son ombre. On y écrit à l'encre
brune. Les titres ont la voix d'un livre ; le reste est composé dans un sans
lisible, sans caractère ostentatoire.

### Typographie

- **Titres (`--font-display`) : Frank Ruhl Libre, en latin.** C'est la police
  que le site utilise déjà pour les textes hébreux (elle vient du caractère
  Frank-Rühl, celui des livres). Ses lettres latines donnent aux titres de
  pages, au nom du site et aux étiquettes de tête une seule voix avec les
  versets qu'elles annoncent, et elle ne coûte aucun chargement de plus. Elle
  ne se choisit pas dans les réglages : c'est la marque.
- **Interface (`--font-sans`) : Source Sans 3** remplace Inter comme police
  d'origine. Humaniste, plus étroite, dessinée pour l'écran, et surtout pas
  celle de tout le monde. Lora et Nunito restent proposées ; un compte qui
  avait gardé « Inter » retombe sur l'origine, qui est le même choix (le sans
  neutre).
- Plus de `tracking-tight` sur les titres : le serrage était fait pour Inter.

### Couleurs

- **Une dominante et un accent, jamais un dégradé.** Chaque thème garde son
  identifiant (Océan, Coucher de soleil, Émeraude) et ses préférences
  enregistrées, mais ses deux couleurs ne sont plus deux voisines : Océan est
  un bleu profond (`#2A5B9E`) et un ocre (`#B07A2E`, la lumière qui passe
  entre les pierres du mur) ; Coucher de soleil, une terre cuite et un bleu
  ardoise ; Émeraude, un vert olive et un cuivre.
- **Chaque thème a sa version pour le sombre** : une encre qui tient sur le
  papier s'éteint sur la nuit. `useTheme` choisit la bonne version et la
  repose quand l'apparence bascule.
- **Le sombre devient une nuit chaude** (`#17140f`, surfaces `#221d17`) : la
  même pierre, la lumière en moins. Barre système de l'app, aperçus des
  réglages et introduction de première ouverture suivent.
- Les surfaces ne sont plus blanc pur mais crème (`#fffdf8`), l'encre est
  brune (`#2b2620`).

### Surfaces, rayons, ombres

- `.card` : un liseré d'un pixel (`--color-line`) et une ombre à peine
  visible. En sombre, le liseré fait ce que l'ombre ne peut plus faire.
- Rayons resserrés : 6 px sur les boutons, champs et puces, 10 et 14 px sur
  les surfaces. Rien au-delà.
- Le bouton rond de la barre basse (app) porte une ombre d'objet, plus un
  halo de sa couleur.

### Composition

- **Le nom du site** est écrit à l'encre dans la police de titrage : une
  marque, pas un dégradé. Le bandeau prend un filet en bas.
- **L'accueil** : le titre reste à gauche sur téléphone (une page se lit,
  elle ne se centre pas), le prénom est à l'encre comme le reste de la
  phrase, et les trois rubriques ne sont plus trois cartes jumelles mais un
  sommaire : une seule feuille, trois entrées séparées d'un filet, les
  illustrations conservées. L'animation d'entrée décalée a disparu ; le
  mouvement, ce sont les illustrations qui se dessinent et s'animent au
  survol, et l'étagère qui se garnit, de loin en loin.
- **Étiquettes de tête** (`.eyebrow`) : en police de titrage, en bas de
  casse, dans la couleur secondaire ou la dominante. Elles remplacent les
  capitales espacées de la page de lecture, de la paracha, des séries, du
  studio, du profil, des horaires et de l'introduction.
- **Filtres** (`.filter-tab`) : du texte et un trait sous le filtre retenu,
  comme les liens du bandeau, à la place des pastilles pleines (catégories
  des chiourim, onglets « mes sessions »).
- **Bandeau du profil** : le nom seul, sur la pierre, avec un filet ; sans
  compte, l'invitation garde ses boutons maison. L'aplat en dégradé qui
  portait le nom ne disait rien de plus que lui.
- Le pied de page prend un filet et perd son emoji.

## 4. Avant, après

Captures prises sur le serveur de dev, en visiteur (sans compte), le même
jour, sur `main` puis sur cette branche.

| Avant | Après |
| --- | --- |
| ![Accueil, avant](assets/refonte-ui/avant-home-desktop-light.jpg) | ![Accueil, après](assets/refonte-ui/apres-home-desktop-light.jpg) |
| ![Accueil sur téléphone, avant](assets/refonte-ui/avant-home-mobile-light.jpg) | ![Accueil sur téléphone, après](assets/refonte-ui/apres-home-mobile-light.jpg) |
| ![Accueil en sombre, avant](assets/refonte-ui/avant-home-desktop-dark.jpg) | ![Accueil en sombre, après](assets/refonte-ui/apres-home-desktop-dark.jpg) |
| ![Tehilim sur téléphone, avant](assets/refonte-ui/avant-tehilim-mobile-light.jpg) | ![Tehilim sur téléphone, après](assets/refonte-ui/apres-tehilim-mobile-light.jpg) |
| ![Chiourim, avant](assets/refonte-ui/avant-chiourim-desktop-light.jpg) | ![Chiourim, après](assets/refonte-ui/apres-chiourim-desktop-light.jpg) |

## 5. Ce que cette branche change, fichier par fichier

- `src/assets/main.css` : jetons (couleurs, polices, rayons, ombres, sombre
  chaud), `.card` à liseré, `.eyebrow`, `.filter-tab`, titres h1/h2 en
  police de titrage.
- `index.html` : Source Sans 3 et Frank Ruhl Libre (latin et hébreu) en
  polices bloquantes, Inter retirée.
- `src/composables/useFonts.ts` : Source Sans 3 en police d'origine, Inter
  retirée des choix ; libellés dans les trois langues.
- `src/composables/useTheme.ts` : palettes retouchées, versions sombres,
  suivi de l'apparence.
- `src/composables/useColorScheme.ts`, `useNativeStatusBar.ts`, `App.vue`,
  introduction et ses maquettes : le fond sombre chaud.
- `NavbarComponents.vue`, `SiteFooter.vue`, `BottomTabBar.vue`,
  `HomeView.vue`, `ProfileHeader.vue`, `ProfilePage.vue`,
  `AppearanceSettings.vue` (aperçu des thèmes en aplat), et les pages qui
  portaient des capitales espacées ou des filtres en pastilles.

Les tests passent (`npm run verify`), dont ceux qui figent la police
d'origine et les couleurs des thèmes.

## 6. Ce qui reste à faire, par ordre d'intérêt

1. **Les listes de textes** (page d'un corpus, résultats de recherche) : sur
   téléphone, chaque texte est encore une carte. Des lignes séparées d'un
   filet, dans une seule feuille, se liraient mieux et pèseraient moins.
2. **La frise « Comment ça marche »** du partage de lectures : quatre ronds
   pleins avec une icône, c'est la vignette répétée du tableau. Des numéros
   en police de titrage feraient l'affaire.
3. **Les `animate-[fadeIn]`** posés sur les blocs de la plupart des pages
   (une cinquantaine) : ils sont discrets et servent de transition de page,
   mais un seul fondu au niveau de la vue suffirait.
4. **Les puces de type de texte** (`bg-primary/10 text-primary`) : encore
   le même motif partout ; une puce à liseré, sans fond, serait plus près
   du papier.
5. **Le lecteur audio** : le bouton rond bleu plein au milieu de la carte
   peut prendre l'encre.
6. **Les captures des fiches Play Store et App Store** sont à refaire
   (`npm run store:screenshots`), elles montrent l'ancienne interface.
7. **Embarquer les polices** (déjà noté dans l'audit de performance) :
   Source Sans 3 et Frank Ruhl Libre en woff2 sous-ensemblés, pour ne plus
   dépendre de Google Fonts au premier rendu.
