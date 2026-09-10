# Charte graphique

Ce document est la référence de l'apparence du site et de l'app. Il dit ce
qu'on emploie, et surtout ce qu'on n'emploie plus. Toute nouvelle page s'y
range ; toute exception se discute et s'écrit ici.

Le fil conducteur tient en une image : la pierre de Jérusalem. Des surfaces
franches, chaudes, posées à plat ; des couleurs pleines qui accrochent l'oeil
là où il faut agir ; rien de vaporeux.

## 1. Le fond, les surfaces

| Rôle                              | Jeton                    | Clair      | Sombre       |
| --------------------------------- | ------------------------ | ---------- | ------------ |
| Fond de page                      | `--color-bg-beige`       | `#f4f1ea`  | `#111827`    |
| Surface (carte, panneau, fenêtre) | `--color-surface`        | `#ffffff`  | `#1f2937`    |
| Surface douce                     | `--color-surface-soft`   | `#f8f5ef`  | `#273244`    |
| Texte                             | `--color-text-primary`   | `#35312a`  | `#f3f4f6`    |
| Texte secondaire                  | `--color-text-secondary` | `#6d6759`  | `#9ca3af`    |
| Filet                             | `--color-line`           | noir à 8 % | blanc à 10 % |

Une surface se détache du fond par son ombre, jamais par une bordure. Les
trois ombres (`--shadow-card`, `--shadow-card-hover`, `--shadow-pop`) sont
teintées chaud pour rester dans la famille du beige.

### La carte est cliquable, et elle le dit sans flèche

Une carte mène quelque part : elle est un lien ou un bouton, entièrement, y
compris ses marges. Le petit chevron gris posé au bout ne servait qu'à répéter
ce que la carte fait déjà comprendre, il ajoutait une cible qui n'en est pas
une (le clic marche partout) et il volait la place du contenu. Il n'y en a
plus sur une carte.

Trois flèches restent, parce qu'elles ne disent pas « cliquable » :

- la **direction** (le chiour suivant, le chapitre précédent, le mois d'après) ;
- le **dépliement** (une flèche qui pivote sur un bloc qui s'ouvre) ;
- la **ligne de liste** dans un panneau (les pages du profil), qui n'a ni
  cadre ni ombre et où le chevron est la seule marque du lien.

Corollaire : un bloc qui ne mène nulle part n'est pas une carte cliquable. Il
peut rester une surface (un panneau de réglages, un formulaire), mais il ne
prend jamais `card-hover`, dont l'ombre qui se creuse promet un clic.

### Le cadre se mérite

Tout n'a pas à être dans une carte. Une carte dit « voici une réponse à une
question que vous vous posez » : ma lecture du jour, l'heure qui vient, une
session en cours. Elle contient une donnée, un état, quelque chose qui change.

Un simple endroit où aller n'en est pas une : les trois portes du site, sur
l'accueil, sont posées à même le beige, rien entre elles qu'un écart, avec le
titre qui prend la couleur au survol pendant que le dessin s'anime. Pas de
filet non plus : une ligne entre elles redessinait les cases dont on venait de
les sortir. Encadrées, elles se disputaient le regard avec
les cartes du tableau de bord et la page devenait un empilement de boîtes ;
sans cadre, les seules surfaces blanches sont celles qui répondent, et la page
se lit en deux temps.

Rien n'indique le clic en plus : ni chevron posé au bout, ni flèche qui
apparaît au survol. La couleur qui vient sur le titre suffit, et sur un écran
tactile aucune de ces marques ne se voit de toute façon.

Dans l'app, ces trois portes tiennent sur une seule ligne, un dessin et un
titre, sans la phrase de présentation : l'écran est étroit, la barre du bas
attend juste en dessous, et on sait ce qu'est la bibliothèque quand on a
installé l'app. La phrase sert au visiteur du site, pas à l'habitué.

### Le mode d'emploi ne tient pas la page

Une explication se lit une fois. « Instructions », posé en clair entre
l'avancement d'une chaîne et la liste de ses textes, repoussait les textes de
quatre lignes à chaque visite, y compris pour l'habitué qui sait depuis
longtemps comment on réserve. Elle rejoint la rangée de pastilles qui décrivent
la chaîne (le type, la date limite, le créateur) et s'ouvre en fenêtre quand on
la touche.

Et elle montre plutôt qu'elle n'explique : chaque geste (chercher, réserver,
rendre, marquer lu, lire) s'y joue en petit, dans une capture **dessinée**
(`src/components/mock`), qui suit le thème et la langue, ne pèse presque rien
et ne vieillit pas d'une refonte à l'autre comme le ferait une vidéo. Une
phrase seule (« cochez les cases pour réserver ») ne dit pas grand-chose
tant qu'on n'a pas vu la case se cocher.

D'où la règle de cette rangée : une pastille **énonce**, sauf celle qui porte
une **icône**, qui **ouvre**. Rien d'autre ne la distingue, ni chevron ni
flèche ; au survol, sa teinte se fonce, et sur un écran tactile l'icône suffit.

Un **chiffre qui compte des gens s'ouvre sur leurs noms** de la même façon : la
barre d'avancement dit combien participent, la toucher dit qui, et où chacun en
est de ses lectures.

Corollaire : ce qui ne propose plus rien s'efface au lieu de s'éteindre. La
carte du tirage au sort disparaît quand tous les Tehilim sont pris, plutôt que
d'offrir un bouton grisé. Dans « Je participe », la chaîne dépliée d'office est
la première où il me reste à lire, pas la première de la liste : celle dont j'ai
tout lu n'attend plus rien de moi. Et la ligne « Reprendre ma lecture » de la
bibliothèque ne propose que la dernière : la refermer la fait disparaître, elle
ne remonte pas l'historique texte par texte (chaque texte, lui, rouvre toujours
là où on l'avait laissé).

### Deux pages, un jeu d'onglets

La barre du bas de l'app tient quatre onglets, pas un de plus. Des pages qui
vont ensemble n'y ont donc pas toutes leur place, et elles finissaient
introuvables : le partage de lectures n'était atteignable que par l'accueil, le
calendrier des fêtes par un petit lien perdu sous le titre des horaires. Elles
se rangent deux par deux, là où l'on est déjà (`PageTabs.vue`, app native
seulement) :

- **Lecture** et **Partage**, en tête de la bibliothèque : lire un texte, ou se
  le répartir à plusieurs ;
- **Horaires** et **Calendrier** : les horaires du jour, ou les fêtes de
  l'année.

Sur le site, ces onglets ne servent pas : le bandeau y mène d'un clic (le
calendrier des fêtes y a son entrée depuis).

Deux règles y tiennent :

- ce sont deux **vraies pages**, pas deux panneaux. Chacune garde son adresse,
  donc son lien partageable, son retour Android et sa reprise de défilement ;
  l'onglet ne fait que les relier.
- les onglets **tiennent lieu de titre** sur ces pages. « Lecture » au-dessus
  de « Bibliothèque » disait deux fois la même chose et coûtait deux lignes en
  haut d'un écran de téléphone ; le `h1` reste, en `sr-only`, pour les lecteurs
  d'écran.

### Un titre de page est centré

Sur le site comme dans l'app, le titre d'une page est centré, et ce qui le
sert (le lieu de calcul des horaires, une phrase d'explication) reste centré
sous lui. Une page qui alignait son titre à gauche pendant que les autres le
centraient donnait l'impression d'avoir été oubliée.

Les commandes qui l'accompagnent sont de vrais boutons (`btn`), centrés à leur
tour : en petits liens colorés, sur un téléphone, personne ne voyait qu'on
pouvait les toucher, et le pouce les manquait.

Dans la barre du bas, c'est l'onglet Bibliothèque qui reste allumé sur tout le
partage, comme sur les pages d'un corpus (`activeOn` dans `BottomTabBar.vue`,
le `active-class` de RouterLink comparant les routes déclarées et non les
adresses).

### Une ligne de liste peut devenir une commande

Dans l'app, une ligne d'horaire n'est plus seulement du texte : la toucher pose
un rappel, la tirer vers la droite découvre un fond de la couleur du thème
portant une cloche (voir `ZmanRow.vue`). Sur le site, la même ligne reste du
texte : il n'y a rien à programmer dans un navigateur, et une commande qui ne
mène nulle part serait pire que pas de commande du tout.

Quatre règles en découlent, valables pour toute liste qui s'anime ainsi.

Le geste a trois issues, et c'est le doigt qui choisit laquelle. Retenu, il
laisse la ligne revenir. Arrêté en chemin, il l'ouvre sur sa cloche, qu'on
touche alors pour ouvrir les réglages : on a le temps de lire ce qu'on
déclenche. Poussé franchement, au-delà de la moitié de la ligne, il agit seul
et la ligne se referme sur son résultat, annoncé par un toast. Le raccourci
récompense l'assurance sans piéger l'hésitation.

Le fond découvert est plein, de la couleur du thème, et il vient de derrière
la ligne : il n'y a ni cadre ni surface intermédiaire, la ligne se déplace et
laisse voir ce qui l'attendait. La cloche reste collée au bord de la ligne,
elle avance avec elle plutôt que d'apparaître d'un coup.

Le premier mouvement franc arbitre entre défiler et glisser. Sans cet
arbitrage, un pouce qui parcourt la page ouvrait les lignes au passage. Et une
seule ligne reste ouverte à la fois, sinon la liste se couvre de tiroirs
entrouverts.

Ce qu'un geste a produit se voit sans être lu. Un rappel posé marque sa ligne
d'un petit triangle plein dans l'angle, du côté de l'heure : une cloche posée
dans le texte aurait mangé la place du nom sur un téléphone, et une ligne sur
deux marquée aurait fait une colonne d'icônes. L'angle, lui, ne prend la place
de rien et se repère d'un coup d'oeil en parcourant la liste. Le triangle suit
le sens de lecture (bordures logiques), il change donc de côté en hébreu.

## 2. Les couleurs de thème

Trois duos au choix, dans cet ordre. Le premier est celui d'origine.

| Thème           | `primary` | `secondary` |
| --------------- | --------- | ----------- |
| sunset (défaut) | `#DE4F17` | `#C98A00`   |
| ocean           | `#1E6BF0` | `#0891B2`   |
| emerald         | `#059C66` | `#0D9488`   |

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

C'est une **exception assumée** au niveau AA : 4,5 est le seuil d'un texte de
taille courante, et aucun des trois `primary` ne l'atteint, ni en encre sur le
beige, ni sous du blanc dans un bouton plein. On l'accepte parce que `primary`
ne porte jamais un texte de lecture : des libellés courts, en demi-gras, et
des titres. Le jour où il en portera un, c'est le jeton d'encre ci-dessus qu'il
faudra, pas un thème plus terne.

## 3. Les rayons

Deux familles, et elles vont en sens contraire. Les **surfaces** sont taillées
franc, comme la pierre, à peine adoucies aux angles ; les **commandes** sont
nettement rondes, pour se donner à toucher. C'est le contraste entre les deux
qui fait lire un bouton comme un bouton.

| Jeton                                  | Valeur                   | Pour                                                                   |
| -------------------------------------- | ------------------------ | ---------------------------------------------------------------------- |
| `--radius-card` (`rounded-card`)       | 6 px                     | cartes, panneaux, listes, tuiles, squelettes                           |
| `--radius-control` (`rounded-control`) | 10 px                    | petites commandes : bouton d'icône, champ, bouton d'un groupe segmenté |
| `--radius-btn` (`rounded-btn`)         | 14 px                    | boutons, coques de groupes segmentés, lignes de menu                   |
| `--radius-pill` (`rounded-pill`)       | 999 px                   | puces, pastilles, curseurs                                             |
| `--radius-xs` … `--radius-3xl`         | 2, 3, 4, 6, 8, 10, 14 px | l'échelle Tailwind, réglée sur la famille des surfaces                 |

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

| Jeton                             | Famille                | Pour                                                                    |
| --------------------------------- | ---------------------- | ----------------------------------------------------------------------- |
| `--font-display` (`font-display`) | Playfair Display       | le titre de page (`h1`, d'office) et le peu qu'on met vraiment en avant |
| `--font-sans` (`font-sans`)       | Manrope                | tout le reste : textes, boutons, étiquettes, chiffres                   |
| `--font-hebrew`                   | au choix               | le texte hébreu d'une lecture                                           |
| `--font-reading`                  | au choix               | le texte latin d'une lecture (traduction, phonétique, didascalies)      |
| `--font-serif`                    | Lora, Georgia en repli | les tranches des livres de la bibliothèque et la dédicace               |

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

## 5. Les tailles de texte

Une page se lit d'abord de loin : ce qui compte doit sauter aux yeux avant
qu'on ait lu quoi que ce soit. La règle est donc celle de la hiérarchie, pas
celle du confort : le corps d'un texte dit son rang, et deux rangs voisins se
distinguent d'un coup d'oeil.

| Rang             | Classes                 | Taille     | Pour                                                                                  |
| ---------------- | ----------------------- | ---------- | ------------------------------------------------------------------------------------- |
| Accroche         | `text-4xl md:text-6xl`  | 36 / 60 px | le titre d'une page d'entrée (accueil), Playfair                                      |
| Titre de page    | `text-3xl md:text-4xl`  | 30 / 36 px | le `h1` d'une page ordinaire, Playfair                                                |
| Porte            | `text-2xl md:text-3xl`  | 24 / 30 px | les trois destinations de l'accueil, Playfair, centrées dès qu'elles sont côte à côte |
| Chiffre en avant | `text-4xl md:text-5xl`  | 36 / 48 px | une heure, un pourcentage, un compteur ; `tabular-nums`                               |
| Titre de section | `text-xl md:text-2xl`   | 20 / 24 px | un `h2` qui découpe une page                                                          |
| Titre de carte   | `text-base` à `text-lg` | 16 / 18 px | l'étiquette d'une carte de tableau de bord                                            |
| Corps            | `text-base`             | 16 px      | le texte courant                                                                      |
| Corps secondaire | `text-sm`               | 14 px      | une explication, une ligne de contexte                                                |
| Méta             | `text-xs`               | 12 px      | une date, une unité, une mention                                                      |

Trois règles qui vont avec :

- **Une carte ne porte qu'une chose en grand** : celle qu'on vient y chercher.
  L'heure sur la carte des horaires, le pourcentage sur celle de la lecture du
  jour. Tout le reste de la carte la sert et passe donc en dessous.
- **Le chiffre en avant tombe toujours au même endroit** (à la fin de la
  ligne) d'une carte à l'autre : le regard le retrouve sans le chercher. Il est
  centré sur le bloc de texte qui l'accompagne, et ce texte est serré à gauche,
  ligne sous ligne : un grand vide entre les deux les ferait lire comme deux
  cartes au lieu d'une.
- **Rien ne se coupe.** Un texte qui porte du sens (le nom d'un texte, d'un
  horaire, d'une section) passe à la ligne ; il n'est jamais rogné par des
  points de suspension, qui font passer une chose pour une autre (« Fin du
  Chéma… ») ou cachent justement le chiffre qu'on cherchait. Quand une ligne
  ne tient pas, on raccourcit ce qui est écrit ou on retire une icône, on ne
  coupe pas. La troncature ne reste que là où la boîte est physiquement figée
  (le titre du lecteur audio dans sa barre d'une ligne).

## 6. Les fenêtres du système

Aucune fenêtre du système ne s'ouvre par-dessus l'app : ni la roue grise d'un
`<select>`, ni le calendrier bleu d'un `<input type="date">`, ni `alert()` ou
`confirm()`. Ces fenêtres-là n'ont ni nos couleurs, ni nos rayons, ni notre
police, et elles arrivent au milieu d'un formulaire qui, lui, les a.

À la place :

| Ce que faisait le système | Ce qu'on emploie                                                                 |
| ------------------------- | -------------------------------------------------------------------------------- |
| `<select>`                | `AppSelect.vue` : le champ, puis un panneau `shadow-pop`                         |
| `<input type="date">`     | `AppDateField.vue` : le champ, puis le calendrier de la maison (`DayPicker.vue`) |
| `confirm()`               | `useConfirm` et `ConfirmDialog.vue`                                              |
| `alert()`                 | un toast (`useToast`)                                                            |

Elles restent de vraies commandes : rôles ARIA, clavier (flèches, Entrée,
Échap), fermeture au clic à côté et retour Android (`useOverlayStack`).

Le calendrier reprend la manière de faire de celui d'Android (Material 3),
parce qu'elle est éprouvée et que les gens la connaissent déjà : la date
retenue s'écrit en toutes lettres en tête, le mois affiché est un bouton qui
ouvre la liste des années (pour aller loin sans user la flèche), et rien n'est
choisi tant qu'on n'a pas confirmé, de sorte qu'on peut parcourir sans rien
casser. L'habillage, lui, est le nôtre.

Deux fenêtres du système restent, parce qu'elles ne sont pas de l'habillage
mais un pouvoir que seul le système a : le **choix d'un fichier**
(`<input type="file">`) et la **feuille de partage** de l'appareil.

## 7. Le bandeau de navigation

Sur le **web**, le bandeau est transparent tant qu'on est en tête de page : il
laisse voir le beige et ne pèse rien. Dès le premier geste de défilement, il
prend un fond translucide et flouté, sans quoi le contenu se lirait à travers
les liens. Sur **mobile**, il est compact : le titre passe au corps courant,
la baseline disparaît, les marges verticales sont réduites de moitié. Le
bandeau publie sa hauteur réelle dans `--navbar-height`, dont dépendent les
barres collantes des pages.

L'app native n'a pas de bandeau : la navigation y passe par la barre du bas
(`BottomTabBar`).

### Le haut de l'app n'a pas de bord

Dans l'app, la page monte jusqu'en haut de l'écran, sous l'heure et la
batterie : rien ne s'arrête à la zone système, et c'est voulu. Un bandeau plein
y ferait une barre de titre, l'app aurait un plafond.

Ce qui manquait, c'est la lisibilité : dès qu'on défile, un titre ou une ligne
de texte passe derrière les icônes du système, et on ne lit plus ni les unes ni
l'autre. D'où le voile (`StatusBarScrim.vue`) : un flou qui va de nul en bas à
fort en haut, sur la hauteur de la zone système et un doigt de plus. On devine
ce qui passe dessous, l'heure reste lisible, et le haut n'a toujours pas de
bord.

Le flou de fond ne se dégrade pas tout seul : quatre couches de force
croissante, chacune masquée en bas, s'additionnent. Sur une petite machine
(`perf-lite`), elles se coupent et il ne reste qu'un voile de la couleur du
fond, qui suffit.

## 8. Ce qu'on n'emploie pas

- Les dégradés décoratifs, sous toutes leurs formes. Un dégradé qui sert à
  **disparaître** n'en est pas un : le voile de la barre système s'efface vers
  le bas, il ne colore rien.
- Les bordures pour détacher une carte du fond : c'est le rôle de l'ombre.
- Les majuscules d'imprimerie et l'interlettrage élargi sur les étiquettes :
  une étiquette de groupe s'écrit en bas de casse, au corps d'un texte
  secondaire (« Mon compte », pas « MON COMPTE »).
- Playfair sur autre chose qu'un titre ou une mise en avant.
- Une couleur codée en dur là où un jeton existe.

## 9. Ce qui reste à faire

Cette charte est en cours d'écriture, au fil des décisions.

- Un jeton d'encre distinct de `--color-primary`, si l'on veut des couleurs
  plus vives sans perdre les liens et les numéros de verset.
- L'icône de l'app porte encore le bleu d'avant : elle se reprendra plus tard.
  Les captures des fiches des stores se régénèrent à la prochaine CI.
