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

Sur la page des horaires, deux rendez-vous prennent ainsi un cadre au milieu
des lignes de la journée : le repos (le Chabbat, une fête, avec son entrée et
sa sortie) et le jeûne (son début et sa fin). Ce ne sont pas des moments de la
journée mais des rendez-vous de la semaine, et tous deux s'annoncent la veille,
en bas de la page, puis passent devant les horaires le jour où ils commencent :
le vendredi, l'heure d'allumage est ce qu'on vient vérifier ; la veille d'un
jeûne, on regarde jusqu'à quelle heure on peut manger.

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

Sous le titre des horaires, le lieu tient sur **une ligne** : le nom de la
ville, qui est le bouton qui la change, et « Ma position », qui la relève. Les
deux sont de petits boutons (`btn-sm`), et le second ne dit que cela : « Utiliser
ma position » et « Actualiser ma position » renvoyaient le bouton à la ligne dès
que la ville avait un nom un peu long, et la distinction ne vaut que pour
l'étiquette lue par un lecteur d'écran. Si le nom de la ville ne tient toujours
pas, c'est lui qui cède, rogné, plutôt que la ligne qui se replie : c'est une
des boîtes physiquement figées où la troncature reste admise (voir « Rien ne se
coupe »).

La phrase qui dit ce que sont ces horaires et ce qu'il advient de la position
ne tient pas la page non plus : un petit « i », à côté des coordonnées, l'ouvre
en fenêtre (voir « Le mode d'emploi ne tient pas la page »). Un refus de la
position, lui, reste en clair : il est urgent, et il change ce qui est affiché.

Dans la barre du bas, c'est l'onglet Bibliothèque qui reste allumé sur tout le
partage, comme sur les pages d'un corpus (`activeOn` dans `BottomTabBar.vue`,
le `active-class` de RouterLink comparant les routes déclarées et non les
adresses).

### Une ligne de liste peut devenir une commande

Dans l'app, une ligne d'horaire n'est plus seulement du texte : la toucher pose
un rappel, la tirer vers la gauche découvre, du côté de l'heure, un fond de la
couleur du thème portant une cloche (voir `ZmanRow.vue`). Sur le site, la même ligne reste du
texte : il n'y a rien à programmer dans un navigateur, et une commande qui ne
mène nulle part serait pire que pas de commande du tout.

Quatre règles en découlent, valables pour toute liste qui s'anime ainsi.

Le geste a trois issues, et c'est le doigt qui choisit laquelle. Retenu, il
laisse la ligne revenir. Arrêté en chemin, il l'ouvre sur sa cloche, qu'on
touche alors pour ouvrir les réglages : on a le temps de lire ce qu'on
déclenche. Poussé franchement, au-delà de la moitié de la ligne ou d'un coup
sec, il agit seul et la ligne se referme sur son résultat, annoncé par un
toast. Le raccourci récompense l'assurance sans piéger l'hésitation, et il ne
pose aucune question : le rappel qu'il pose reprend le dernier délai réglé
(15 minutes avant tant qu'on n'en a pas choisi un autre), car qui règle ses
rappels à une demi-heure les veut tous ainsi.

Le fond découvert est plein, de la couleur du thème, et il occupe exactement
la place que la ligne libère en partant : il n'y a ni cadre ni surface
intermédiaire, et son icône se tient au milieu de ce qu'on a découvert, jamais
à cheval sur ce qui reste. Le repère d'angle, lui, s'efface le temps du geste :
posé contre un tiroir de la même couleur, il n'aurait plus été un repère mais
une bavure.

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

### Ce qui est à soi se range avec le reste

Les dates qu'on ajoute au calendrier (un anniversaire, un leilouy nichmat) ne
font pas une liste à part, sous les fêtes ou derrière un onglet. Elles se
rangent dans le calendrier de l'année, à leur date, entre Chemini Atzéret et
'Hanouka s'il le faut : la question posée est la même, « qu'est-ce qui vient
cette année », et deux listes obligeaient à la poser deux fois.

Ce qui les distingue est le dessin qui les ouvre, pas un cadre ni une couleur
de fond : une bougie pour un leilouy nichmat, un gâteau pour un anniversaire.
Une carte se lit alors comme une fête, et son icône dit d'un coup d'oeil qu'
elle est à nous. Elle est de surcroît la seule qui se touche : on retombe sur
son réglage, là où on l'a posée.

Mais le calendrier, on n'y va pas tous les jours, et une date qu'on a pris la
peine d'inscrire mérite de venir au-devant : elle paraît sur l'accueil la
semaine où elle arrive, dans la colonne du moment, avec le sidour de l'office
et la bénédiction de la lune, puis s'efface le reste de l'année. Trois au
plus : au-delà, ce n'est plus un rappel mais une liste, et la liste a sa place
dans le calendrier.

Une date pareille survit à un téléphone : elle suit le compte, et se pose donc
aussi bien depuis le site. Ce qui reste propre à l'app, c'est le rappel, que
seul un téléphone peut faire sonner : son réglage ne paraît pas là où il ne
tiendrait pas parole.

Elle ne s'efface pas non plus d'un doigt qui glisse : la corbeille pose la
question, avec le nom de la date, avant d'agir (`useConfirm`). C'est la règle
de tout ce qui part sans retour, et seulement de cela : ce qu'on peut refaire
d'un geste, une case cochée, un rappel posé, ne se fait pas confirmer, sans
quoi la question ne voudrait plus rien dire.

### Trois onglets de réglages, trois questions

Les réglages ne font pas une seule liste. **Apparence** répond à « à quoi
cela ressemble » (thème, polices, taille du texte), **Notifications** à « ce
qui sonne », **Préférences** à « comment l'application se comporte » : l'avis
suivi pour les horaires, le défilement automatique, et ce qui viendra s'y
ranger. Un même écran mêlant les trois obligeait à lire toute la page pour
trouver la ligne qu'on cherchait.

Ce qui atterrit dans Préférences y arrive en **section**, avec son titre, et
la section est faite de LIGNES séparées d'un filet, comme la liste des
horaires. Pas de carte : une carte répond à une question qu'on est venu poser
(voir « Le cadre se mérite »), un réglage est une ligne qu'on touche. Mises en
cartes, trois sections empilées sur un fond beige donnaient trois boîtes
blanches à la suite, et l'onglet ne fera que s'allonger. Les sections se
séparent du même filet que leurs lignes.

### Un geste qui surprend doit pouvoir se couper

Le double appui qui lance le défilement automatique se fait tout seul : deux
appuis rapprochés sur un téléphone, cela arrive, et le texte se met à
descendre sans qu'on sache d'où cela vient. Un interrupteur des Préférences le
retire alors complètement, geste compris, plutôt que de laisser chercher
comment l'arrêter à chaque fois.

Ce n'est pas la même chose que d'éteindre une fonctionnalité par défaut :
elle reste proposée à tous, et seul qui s'en plaint la coupe. Ce réglage-là
est gardé sur l'appareil, et deux fois plutôt qu'une (voir
docs/app-native.md) : un réglage posé pour ne PLUS être surpris ne doit pas
revenir tout seul au lancement suivant.

### Un réglage se pose là où il est atteignable

L'avis suivi pour les horaires (Rav Posen, Rav Ovadia Yossef) gouverne toutes
les heures de l'application : il a donc sa place avec les autres réglages,
dans l'onglet Préférences du profil. Sauf que sur le site, la page de réglages
est réservée aux comptes, et l'avis qu'on suit ne doit pas l'être : un bouton
le porte alors sur la page des horaires elle-même, à côté du nom de la ville,
et il annonce l'avis en cours plutôt qu'un mot vague comme « Réglages ».

C'est la même règle que pour le lieu de calcul : le nom de la ville EST le
bouton qui la change. Ce qu'on lit et ce qu'on règle sont au même endroit, et
le bouton dit l'état avant de proposer le changement.

Dans l'app, le bouton n'est pas repris : la page y est déjà coiffée de deux
onglets et d'une barre du bas, et les réglages sont à un geste.

### Le menu de lecture s'ouvre au-dessus de son bouton

Sur un texte de la bibliothèque, un bouton rond en bas à droite
(`ReadingMenu.vue`) tient lieu de bouton de remontée : il ouvre le sommaire
du texte, la taille des caractères et la bascule hébreu / phonétique. Le
panneau surgit **au-dessus** du bouton, et le bouton reste : il devient la
croix qui referme. Ce qu'on a touché pour ouvrir est ce qu'on touche pour
fermer, au même endroit, sans chercher une croix dans le panneau ; le panneau
ne remplace jamais ce qui l'a ouvert.

À la droite de cette croix paraît un second rond, celui des réglages de
lecture, qui fait passer le panneau du sommaire aux réglages. Les deux ronds
échangent alors leurs rôles : celui de gauche reprend l'icône du sommaire et y
ramène, celui de droite devient la croix. La croix est toujours sur le rond
touché en dernier : on quitte d'où l'on est arrivé.

Ces réglages-là sont ceux qu'on change **pendant** qu'on lit, pas avant : le
défilement automatique (le même interrupteur que dans les Préférences, voir
« Un geste qui surprend doit pouvoir se couper ») et, sur un office, « sans
tahanoun ». Ce dernier dit à l'application ce que le calendrier ne peut pas
savoir : une brit mila, un marié ou un bar-mitsva dans l'assemblée, une maison
de deuil. Le texte est alors refait comme un jour où le tahanoun ne se dit
pas, avec ce qui tombe et ce qui vient à sa place. Il ne vaut que **la
journée** où il est posé et s'éteint au lendemain : une simhá est une affaire
d'un jour, et un interrupteur oublié retirerait le tahanoun des semaines
durant sans que rien ne le montre, la page ne disant jamais ce qu'elle tait.

« Masquer les halakhot » les rejoint, là où le texte lu en porte : les
consignes de loi qui accompagnent un passage (ce qu'on reprend en cas d'oubli)
quittent alors le fil. Elles sont là pour qui doute et encombrent qui sait, et
un office se dit tous les jours. À la différence de « sans tahanoun », c'est
un parti pris de lecture, pas une affaire d'un jour : il tient jusqu'à ce
qu'on le change, et il est éteint au départ, personne ne devant découvrir
qu'une halakha existait le jour où il en aurait eu besoin. Le réglage ne se
montre que sur un texte qui en porte : proposer de masquer ce que la page
n'affiche pas laisserait croire qu'on a raté quelque chose.

Sous les interrupteurs, un filet, puis ce qui se fait d'un geste au lieu de se
régler : partager le texte lu, écrire à l'équipe, et, sur le site, prendre
l'app. Ces trois-là n'étaient qu'au pied de page ou dans l'onglet À propos,
c'est-à-dire là où l'on finit ; or c'est en lisant qu'on veut envoyer un texte
à quelqu'un, et en lisant qu'on voit la coquille à signaler. Ce sont des
lignes, comme les repères du sommaire, et non des boutons pleins : le panneau
reste un panneau de lecture, pas une barre d'outils. Le partage porte
l'adresse **publique** du texte, celle du site, jamais celle de la page en
session ni l'adresse locale de la webview de l'app, que personne d'autre ne
saurait ouvrir.

Corollaire : pas de marque-page sur une tefila (Sidour, Sli'hot, Brahot). Un
office ou une bénédiction se lisent du début, on n'y revient pas à un
paragraphe comme à un verset de Tehilim ; le sommaire du menu y mène déjà à
chaque passage.

### Ce qui clôt une page se lit à la fin

Les hiloulot du jour ferment la page des horaires, sous la dernière heure et
avant la note de bas de page, comme le calendrier imprimé les met au bas de sa
colonne. Pas de carte : une carte répond à une question qu'on est venu poser,
celle-ci ne se pose pas en ouvrant la page (voir « Le cadre se mérite »). Un
titre de groupe, le même que ceux des moments de la journée, et des noms.

Certains jours en portent dix-neuf. On en montre quatre, le reste se déplie :
la page se termine sur une ligne, pas sur un annuaire.

### Écrire à l'équipe se propose où l'on finit, pas où l'on commence

Le formulaire de support (une idée, un bug, une erreur dans un texte) est une
fenêtre, pas une page : on l'ouvre de là où l'on est et l'on y revient en la
fermant, sans perdre la lecture en cours. Il s'ouvre de trois endroits, tous
en fin de parcours : le pied de page du site, l'onglet À propos de l'app, et
le bas de l'accueil.

Une quatrième porte s'ouvre en pleine lecture, dans les réglages du menu
(voir « Le menu de lecture s'ouvre au-dessus de son bouton ») : c'est là qu'on
voit l'erreur dans un texte, et remonter jusqu'au pied de page pour la dire,
c'est perdre sa ligne. Elle ne contredit pas la règle : c'est toujours la
personne qui va la chercher, derrière deux gestes, et non l'application qui
lui coupe la parole.

Sur l'accueil, il tient en une ligne sous la dédicace, en petit et en gris,
avec le seul lien souligné : « Une idée, un problème ? Écrivez-nous ». Pas de
carte ni de bouton plein : l'accueil n'est pas venu poser cette question, et
un bouton coloré tout en bas se disputerait le regard avec les portes du site.
Discret donc, mais visible : la ligne existe dans l'app comme sur le site, là
où l'on arrive après avoir tout vu.

La fenêtre dit ce qu'elle joint sans le demander (le support, la plateforme,
la version) sous le formulaire, en petit : rien ne part à l'insu de la
personne, et personne n'a à recopier un numéro de version.

Le site pose aussi la question de lui-même, une fois : « Tout se passe
bien ? », une petite carte en bas de l'accueil, à qui a ouvert l'app trois
jours différents. Sur l'accueil seulement, jamais sur une page de lecture ni
pendant l'écoute d'un chiour, et jamais par-dessus autre chose (introduction,
fenêtre ouverte, bannière de consentement encore sans réponse) : une question
qu'on pose à quelqu'un d'occupé est une interruption, pas une attention. Elle
attend quelques secondes après l'arrivée, se retire dès qu'on lui répond
(« Tout va bien » ou le formulaire) et n'insiste pas : au plus trois fois, à
une semaine d'écart, puis plus jamais.

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

### Les thèmes des fêtes

Le temps d'une fête, l'app change d'habit, puis retrouve le thème choisi. Un
thème de fête ne se choisit pas : le calendrier le pose et le retire
(`src/services/holidayThemes.ts`, `useHolidayTheme.ts`), et un seul
interrupteur, dans les réglages d'apparence sous les thèmes, l'autorise ou
non pour toutes les fêtes à la fois. Il est allumé d'office : c'est une
attention, pas une option à découvrir ; qui n'en veut pas la coupe une fois.

| Fête    | Période                                                  | `primary`             | `secondary`     | Bouton des horaires | Ornements                 |
| ------- | -------------------------------------------------------- | --------------------- | --------------- | ------------------- | ------------------------- |
| Tichri  | du 16 Eloul (deux semaines avant Roch Hachana) à Kippour | `#D8322F` rouge pomme | `#D9A21B` miel  | une pomme           | un chofar, un pot de miel |
| Souccot | du lendemain de Kippour au lendemain de Sim'hat Torah    | `#4E8A2E` vert loulav | `#D9B324` étrog | une soucca          | un loulav, un étrog       |

Trois choses changent, pas une de plus :

- **les couleurs** : le duo de la fête prend la place de `primary` et
  `secondary`, partout où ils servent, widgets et montre compris. Les mêmes
  bornes de lisibilité que les thèmes choisis s'appliquent (voir
  « Lisibilité ») ; le vert de Souccot est pris plus franc et plus jaune que
  l'émeraude, pour qu'on ne les confonde pas ;
- **les ornements** : deux dessins par fête, dans le style des illustrations
  des portes (`src/components/holiday`), posés à même le fond en tête de
  l'accueil, de part et d'autre d'un souhait. Pas de carte : c'est une parure,
  pas une réponse. Ils servent aussi d'aperçu dans les réglages ;
- **le bouton rond des horaires** de l'app native, qui prend la forme d'un
  objet de la fête : c'est le bouton que tout le monde touche chaque jour, et
  c'est là que la fête se voit d'abord.

Ce qui passe devant quoi : le survol d'un thème dans les réglages (choisi ou
de fête), puis la fête en cours, puis le thème choisi. Le choix reste le choix
pendant la fête, on le retrouve après. Une fenêtre se compte en jours civils,
pas à la chkia : un thème qui change dans la nuit ne trompe personne, un thème
qui changerait à 19 h 42 le ferait sous les yeux. Le lendemain de Kippour
appartient à Souccot, le jour où l'on commence la soucca.

Les fêtes suivantes ('Hanouka, Pourim, Pessah…) viendront s'ajouter au même
catalogue, avec les mêmes trois changements.

### Ce que le jour ajoute dans une tefila

Dans le lecteur de liturgie (`LiturgyText.vue`), `primary` sert d'encre à
ce que le jour ajoute ou change dans le fil du texte, comme le rouge d'un
siddour imprimé : Hamélekh hakadoch aux dix jours de techouva, Zokhrénou au
milieu d'Avot, Ya'alé véyavo à Roch Hodech, 'Al hanissim à 'Hanouka, le
compte du 'Omer de ce soir. Le passage se lit à sa place, dans le paragraphe
qu'il complète, et il n'est là que le jour où il se dit : le reste de
l'année, le texte ordinaire tient la place, à la couleur du texte.

Ce qui ne se colore pas : un passage entier conditionnel (le Hallel, Avinou
Malkénou, le psaume du jour, le tahanoun), dont le titre suffit à dire
l'occasion et qu'une colonne entière de `primary` rendrait illisible ; et le
texte de saison (morid hatal, Barekh 'alénou), qui est le texte ordinaire de
six mois, sauf les trois premières semaines d'une bascule, où c'est là qu'on
se trompe (`recentSeasonalChanges`). Ce que l'application ne peut pas
trancher (en Terre d'Israël, à dix convives) reste en gris : une possibilité
signalée, pas une lecture imposée.

C'est l'exception à « `primary` ne porte jamais un texte de lecture » : un
fragment court, dans un paragraphe qu'on lit d'un trait. La halakha de
l'oubli (« si l'on a conclu haEl hakadoch, on recommence ») accompagne le
passage, en didascalie, les jours où elle sert.

### Le parchemin s'ouvre depuis le texte

Deux passages du sidour ont leur forme propre sur un parchemin : le pitoum
haketoret, que beaucoup lisent sur un klaf écrit par un sofer, et le psaume
67 (Lamnatséa'h binguinot), qu'il est bon de dire en regardant la menora dans
laquelle il est écrit. L'app ne les redessine pas dans le fil : elle pose, au
paragraphe où ils se disent, une petite commande ronde (`.reading-klaf`,
dans `LiturgyText.vue`), une pastille à la couleur du thème, à la taille des
didascalies, qui ouvre une fenêtre (`KlafViewer.vue`). C'est la seule porte :
à la différence de la boussole et du miroir, le menu de lecture ne propose pas
les parchemins, on les ouvre à l'endroit où on les lit.

La fenêtre montre d'abord la photo du parchemin, telle quelle
(`public/klaf/`), qu'un toucher agrandit au double ; un second onglet en donne
la retranscription, lettre à lettre et sans voyelles, dans l'écriture du sofer
(la police Stam Sefarad CLM, voir « Les polices ») et à la taille de lecture
du lecteur : le même rendu que le klaf, mais du texte. Pour le psaume, la retranscription
reprend la forme du parchemin : sept branches verticales, une barre, un pied,
en traits pleins à la couleur du texte, sans ombre ni dégradé. C'est une
écriture, pas une illustration.

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

Une seule autre famille a droit de cité, et à un seul endroit : **Stam Sefarad
CLM** (projet Culmus, GPL avec exception d'embarquement,
`public/fonts/stam-sefarad-clm.LICENSE.txt`), l'écriture du sofer, ktav
Sefaradi avec taguim. Elle n'écrit que la retranscription des parchemins
(`KlafViewer.vue`) : là, le rendu du klaf est ce qu'on vient chercher, et
c'est la seule raison d'être de la police. Elle ne sert ni au fil d'un texte,
ni à un titre, ni à une étiquette.

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
  (le titre du lecteur audio dans sa barre d'une ligne, le nom de la ville sur
  la ligne du lieu des horaires).

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

### Une fenêtre modale tient dans ce qui est visible, clavier compris

Le voile d'une fenêtre modale (`.modal-overlay`) ne couvre pas la page : il
couvre ce qui est **visible**. La nuance ne se voit que le jour où un clavier
logiciel s'ouvre, et ce jour-là elle décide de tout. Un clavier ne rétrécit
pas la fenêtre, il se pose par-dessus : un cadre centré sur la page entière
place alors son champ de saisie sous le clavier, et l'on écrit sans voir ce
qu'on écrit. Le voile prend donc la hauteur du viewport visuel et se pose à
son sommet (`useModalKeyboard.ts` mesure, le style suit), le champ qui prend
le clavier est ramené dedans, et une fenêtre à liste se plafonne à cette
hauteur-là plutôt qu'à une fraction de l'écran.

Le cadre, lui, est centré par des marges automatiques et le voile défile. Un
cadre centré par `align-items` qui dépasse en hauteur se fait couper **en
haut**, hors d'atteinte : le bouton « Envoyer » d'un formulaire un peu long
devenait introuvable sur un petit téléphone. Avec les marges, il est centré
tant qu'il tient et défile dès qu'il déborde ; c'est vrai du formulaire de
support, de la modification d'une chaîne et de tout ce qui viendra.

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
