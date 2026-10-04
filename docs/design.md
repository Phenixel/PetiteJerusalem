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

### Une commande posée dans un texte porte son nom

Dans un texte, une icône seule ne se lit pas comme une commande. Le lecteur y
voit un ornement du passage, une marque de plus dans une page qui en porte
déjà (numéros de verset, didascalies, renvois), et il ne l'appuie pas. La
boussole du Kotel et le miroir des téfilines sont restés à côté de leur titre
sans que personne ne devine qu'on pouvait les toucher.

Une commande posée dans un texte est donc une pastille à la couleur du thème,
qui porte son dessin ET son nom en toutes lettres : « Direction du Kotel »,
« Miroir », le parchemin d'un paragraphe. Le fond, même léger, la détache du
texte ; le nom dit ce qu'elle fait avant qu'on l'ait touchée.

Au titre d'un passage, elle se pose en face du titre, au bout de sa ligne, et
non collée au dernier mot : collée, elle passe pour la suite du titre. Sa
taille ne suit pas celle du texte lu, à la différence de la pastille d'un
parchemin, qui vit dans le fil de la lecture : une commande de titre est un
objet de l'interface, et deux d'entre elles se ressemblent exactement, sur
n'importe quelle page et à n'importe quelle taille de lecture.

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

### Une astuce se joue sur la page, une fois

L'introduction dit ce que l'app contient ; elle ne peut pas dire comment
chaque écran se manie. Une ligne d'horaire qui se tire pour poser un rappel,
le bouton rond d'une page de lecture qui ouvre le sommaire et les réglages :
personne ne devine un geste, et une commande qu'on ne connaît pas ne sert à
personne. Ces deux-là avaient été expliquées nulle part, et donc jamais
employées.

L'astuce se joue donc **là où la commande est**, la première fois qu'on
arrive sur la page (`FeatureTour.vue`, `useFeatureTips`) : un voile assombrit
la page, un projecteur découpe la commande, un liseré de la couleur du thème
respire autour, et une bulle avec sa flèche dit en deux phrases ce qu'elle
fait. Quatre règles la tiennent :

- **la commande reste vivante sous le projecteur.** Le voile n'est pas peint
  à cet endroit : la toucher fait ce qu'elle fait d'habitude, et l'astuce
  passe au pas suivant ou s'en va, on a compris. Elle **montre** aussi quand
  elle le peut : sur les horaires, un doigt dessiné (`MockTouch`) se pose sur la première ligne, la tire vers la
  gauche jusqu'à sa cloche et la lâche, le temps du pas, puis le nom de la
  ville, qui est le bouton qui la change, prend le projecteur ; sur une
  lecture, l'astuce ouvre le panneau pour éclairer le téléchargement du
  texte, puis le rond des réglages ;
- **elle se passe d'un geste** : « Passer », le voile, Échap ou le retour
  Android. Le voile n'écoute qu'une fois l'astuce posée (`VEIL_GRACE_MS`) : un
  appui dans l'instant où elle paraît est le geste d'avant qui continue (la
  flèche des horaires touchée une fois de plus), et il la fermait pour de bon
  avant qu'on l'ait lue. « Suivant » ou « Compris » la mènent au bout. Jamais
  plus de deux ou trois pas. Un pas sans commande à éclairer (pincer le
  texte, le double appui) pose la bulle au milieu et **montre** le geste dans
  une capture dessinée (`src/components/mock`) ;
- **une fois par appareil, et une seule par ouverture de l'app.** Close, elle
  est notée vue (dans les deux stockages, voir docs/app-native.md), même si
  l'on quitte la page au milieu : une astuce qui revient n'est plus une aide.
  Et quatre bulles à la suite en changeant de page seraient un tutoriel
  qu'on n'a pas demandé : la suivante attend la prochaine ouverture (une
  relance de l'app, ou un retour au premier plan après une demi-heure
  ailleurs). Sur une même page, une astuce peut en attendre une autre : les
  gestes de lecture viennent une ouverture après le menu. « Revoir les
  astuces » (profil de l'app, groupe Aide) les remet en jeu, page par page ;
- **« Plus tard »** : on n'a pas toujours le temps de lire. La bulle se
  retire sans compter l'astuce vue, et celle-ci revient, sur la même page, à
  l'ouverture suivante ;
- **jamais par-dessus autre chose** : ni l'introduction, ni une fenêtre
  ouverte, ni une autre astuce, ni une commande hors de l'écran ; et elle
  attend que la page se soit posée. Sous l'introduction, elle attend qu'elle
  se ferme : c'est le cas de l'astuce de l'accueil, à la première ouverture.

L'accueil porte la première : où l'app se règle à son goût (l'onglet en bas
à droite, thème, police, mode sombre), puis le compte, ce qu'il apporte
(partager des lectures, la lecture du jour, ses réglages sur un autre
appareil) et, avant tout, qu'il n'est pas obligatoire. Elle éclaire le bouton
« Créer un compte » tant que l'accueil le porte, et ne se propose pas à qui a
déjà un compte.

Les autres, chacune sur sa page : les horaires (le rappel d'un geste, le
lieu), le calendrier (ses propres dates, qui reviennent sur l'accueil et se
rappellent), la lecture (le menu, lire hors ligne, les réglages ; puis les
gestes, une ouverture plus tard), le partage de lectures (créer une chaîne,
en rejoindre une, la première de la liste sous le projecteur) et la lecture
du jour (composer sa liste, la cloche du rappel). Une astuce ne présente que
ce que la page propose : pas de rappel sur le site, pas de téléchargement
quand le texte n'en a pas.

Une astuce peut aussi être **appelée par un geste** plutôt que par
l'arrivée sur la page : celle du calendrier des horaires (`zmanim-date`) ne
se montre qu'au troisième appui de suite sur une flèche de jour. On en a vu
toucher la flèche jusqu'à 37 fois pour atteindre un Chabbat ou une fête, le
calendrier restant ignoré sous le titre de la date
(`docs/audit-usage-posthog-2026-10.md`, 2.3). Le projecteur se pose sur la
date, qui est le bouton du calendrier ; qui l'a ouvert de lui-même ne la
verra jamais. Les règles des autres valent pour elle : une fois par appareil,
une seule par ouverture de l'app.

App native seulement, comme l'introduction : un visiteur du site arrive par
une page précise et une bulle en travers de ce qu'il vient lire serait une
gêne. `?tips` dans l'adresse les force partout où la commande existe (ou
`?tips=reading-gestures` pour une seule), pour les montrer et les essayer sur
les canaux de preview.

### L'introduction règle d'abord, les gestes viennent en dernier

L'introduction de première ouverture (`OnboardingFlow.vue`) pose quelques
réglages, dit ce que l'app contient, puis montre les gestes à qui veut les
voir. Elle comptait six pages, consentement compris, avec des captures
animées dès la troisième : près de la moitié des gens la passaient, presque
tous dès la première page après le consentement. Elle en compte cinq, chacune
courte :

- **le consentement**, en trois lignes, parce qu'il demande un choix ;
- **les réglages** : la langue, clair ou sombre, le thème, rien de plus
  (`AppearanceSettings essentials`). Les polices et les thèmes des fêtes
  attendent dans le profil ;
- **les textes à emporter**, le seul réglage qui fasse quelque chose ;
- **l'essentiel** : la bibliothèque, les horaires, la lecture du jour, une
  ligne chacun, et le bouton qui compose la lecture du jour ;
- **les gestes** : le menu de lecture, le pincement, le double appui, en
  captures, avec les textes des astuces du lecteur.

Les quatre premières n'ont pas de « Passer » : on tient à ce qu'elles soient
lues, et elles sont courtes pour qu'on les lise. Seuls les gestes se passent
(le bouton, Échap), sans dommage : les mêmes reviennent en astuces sur la
page de lecture. Une page nouvelle doit gagner sa place contre les autres,
et ce qui s'apprend en le faisant va avec les gestes, pas avant.

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

### L'accueil de l'app salue, il ne présente pas

Dans l'app, l'accueil d'un visiteur non connecté s'ouvre sur une salutation
(« Bonjour », « Bonsoir »), alignée à gauche comme celle d'un visiteur
connecté, et sur les boutons du compte en taille ordinaire. L'accroche du site
(grand titre et paragraphe de présentation) n'y paraît pas : qui a installé
l'app n'a plus à être convaincu, et ces lignes repoussaient les horaires et
les trois portes sous le pli. Le site, lui, garde son accroche centrée.

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

### Deux colonnes sur un téléphone, seulement si la seconde se plafonne

Une carte du calendrier porte deux choses : le nom de la fête avec ses dates,
et ses heures. Côte à côte sur un téléphone, elles ne tiennent pas. Le libellé
le plus long de la colonne des heures (« Allumage après la sortie du Chabbat »)
décidait seul de sa largeur, qui prenait la carte entière : il ne restait au
nom que la largeur d'un mot, « Chabbat Roch Hachanah » descendait en escalier,
et les deux colonnes finissaient par se chevaucher.

D'où la règle, valable pour toute carte à deux colonnes. Tant que l'écran est
étroit, la seconde passe sous la première, séparée par un filet, chaque heure
finissant sa ligne comme sur la page des horaires. Dès qu'il y a de la place
(`sm`), elle revient à côté, mais plafonnée en largeur : une colonne qui se
dimensionne sur son plus long libellé mange la carte, et ce qu'on lit en
premier, le nom, passe en dernier.

Une plage de dates, enfin, n'écrit qu'une fois ce que ses deux bouts
répètent : « du 1 au 2 Tichri 5787 », et non « du 1 Tichri 5787 au 2 Tichri
5787 ». Trois lignes de moins sur un téléphone, et rien de perdu
(`formatHebrewRangeStart`).

### Ce qu'on vient chercher prend la couleur, pleine

Mettre une carte en avant sans poser de couleur sur elle ne marche pas. Un
cadre teinté est une bordure de plus dans une page qui n'est faite que de
bordures ; un fond à quelques pour cent de la couleur du thème ne se détache
pas du beige ; et l'encre seule, qui suffit à marquer le prochain horaire de
la journée dans une liste de lignes (`ZmanRow`), se perd dans une liste de
cartes, où chacune porte déjà trois niveaux de texte.

La prochaine fête du calendrier prend donc la couleur du thème à plein, sur
toute sa carte, et son texte passe au blanc. C'est la seule carte colorée de
la page, et on la trouve sans avoir à lire.

Le blanc y descend en trois tons, comme sur le bandeau du profil, le seul
autre endroit où l'on écrit sur la couleur : le nom de la fête et ses heures à
plein, les dates et les intitulés des heures en dessous, la date hébraïque
plus bas encore. Sans quoi tout se vaudrait et la carte ne se lirait plus.

Les dates passées, elles, gardent leur effacement : s'effacer et ressortir
sont deux moyens opposés, ils ne se gênent pas.

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

### Une date se saisit comme on la connaît

Une date personnelle revient à sa date hébraïque, et c'est elle qu'on demande
d'abord : le jour et le mois, sans année. Mais beaucoup ne connaissent que la
date civile d'une naissance ou d'un décès. Un bouton sous les deux listes,
« Saisir la date civile », ouvre le calendrier de la maison, année comprise
(la liste des années remonte jusqu'en 1900, une date de naissance va plus
loin qu'une date limite) ; la date hébraïque se calcule et s'affiche sous le
champ, et c'est elle seule qui s'enregistre. Le formulaire ne change pas de
nature, il gagne un chemin, et l'on en revient d'un geste par le même bouton.

Une date civile ne donne pas sa date hébraïque à coup sûr : le jour hébraïque
commence au coucher du soleil. Toute saisie dans ce sens porte donc un
interrupteur « Après le coucher du soleil », éteint par défaut, plutôt que de
laisser un leilouy nichmat se graver avec un jour d'écart.

La date civile sait aussi ce que la date hébraïque seule ne dit pas : l'année.
Une date tombée en Adar I d'une année à treize mois s'enregistre comme telle
(`firstAdar`), et revient en Adar I ces années-là, non en Adar II, un mois
après son jour. Le choix du mois ne propose toujours qu'un Adar, celui de la
date qu'on pose ; « Adar I » ne s'y ajoute que pour la date qui en vient, et
la liste la nomme de même (`hebrewDateConverter.test.ts`,
`occasionCivilEntry.test.ts`).

Pour un leilouy nichmat, une ligne sous l'intitulé de la date dit laquelle
poser : celle du décès, d'où se comptent les années. Seule la première fait
exception : quand le décès vient d'arriver, la première année se compte du
jour de l'enterrement. La ligne ne paraît que pour ce choix ; elle ne dit
rien à qui inscrit un anniversaire (`occasionCivilEntry.test.ts`).

Le même calcul sert le convertisseur du calendrier, à côté de « Mes dates » :
une fenêtre, trois onglets nommés par ce qu'on connaît déjà (une date
hébraïque, une date civile, la naissance d'un enfant pour sa bar-mitsvah). La
réponse se lit dans un bloc de surface douce, sous le formulaire, sans bouton
à presser : elle change avec chaque réglage. Ce n'est pas une page de plus,
c'est une question qu'on se pose devant le calendrier, et elle s'y pose.

### Une recherche trouve ce qu'on voulait dire

Un même nom s'écrit de dix façons : « Chabbat », « Shabbat », « Shabat » ;
« Berakhot », « Brakhot », « Brahot » ; « Pessa'him », « Pesachim ». Le
catalogue lui-même mélange l'anglais de Sefaria et le français. Une barre de
recherche qui ne rend que la graphie exacte ne trouve donc que ceux qui ont
deviné la nôtre, et répond « aucun résultat » à tous les autres.

Toutes les barres du site (bibliothèque, lecture du jour, chaînes de lecture
et leurs textes, chiourim, villes des horaires, invités, administration)
passent par la même recherche, `services/fuzzySearch`, qui répond en trois
rangs :

1. le texte tel quel, sans casse, accents, apostrophes ni voyelles
   hébraïques ;
2. sa clé phonétique, où les graphies d'un même son se confondent (ch, sh,
   kh et h ; tz et ts ; b et v ; k, c et q ; le e du chva qu'on écrit ou
   non ; les lettres doublées) ;
3. la même clé à une ou deux fautes de frappe près, selon sa longueur.

Le troisième rang ne parle que faute de mieux : dès qu'un résultat répond aux
deux premiers, les approchants se taisent. Sans quoi « bava » ramènerait
« Shabbat », à une lettre près, et la liste perdrait sa franchise.

Plusieurs mots se cherchent chacun de leur côté, dans n'importe quel ordre, et
tous doivent répondre ; un nombre se cherche comme un nombre (« 23 » trouve
le Tehilim 23, jamais le 123 ni le 24). Deux lettres ne comptent qu'en début
de mot, et une description ne s'explore que par débuts de mots, sans fautes :
sur une phrase entière, tout répondrait à tout.

Ce que la phonétique ne devine pas s'écrit : « Genèse » pour Berechit,
« Maariv » pour Arvit, « Psaume 23 », les noms hébreux des parachiot
(`datas/catalogAliases`), « London » ou « ירושלים » pour les villes
(`datas/cityAliases`). Ces autres noms ne s'affichent jamais, ils ne servent
qu'à trouver. Quand quelqu'un ne trouve pas un texte qu'il cherchait, c'est
là qu'on ajoute le mot qu'il a tapé.

La bibliothèque garde l'ordre du catalogue, ses résultats se rangeant par
corpus et par livre ; les autres listes rangent du plus pertinent au moins
pertinent, le nom qui commence par la recherche en tête (« lon » : Londres
avant Toulon).

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

### Le profil de l'app est une liste, pas un menu

Sur le site, le profil est un menu à gauche et un panneau à droite : il y a la
place, et un clic change de panneau. Posé tel quel sur un téléphone, ce menu
passait en tête de page, le panneau dessous, et chaque onglet faisait défiler
jusqu'à son contenu : on ne savait jamais sur quel onglet on était, ni ce qui
était réglé sans l'ouvrir. L'app a donc son propre profil
(`NativeProfileHome.vue`), rangé comme les réglages d'un téléphone ; le site
garde le sien, qui lui convient.

- **Une page de lignes, rangées par groupe.** Mes lectures (les raccourcis),
  Réglages (apparence, langue, notifications, préférences), Mon compte
  (sécurité, déconnexion), Aide, Informations. Chaque groupe est un panneau
  (`SettingsGroup`), une surface sans `card-hover`, et ses lignes
  (`SettingsRow`) vont d'un bord à l'autre, séparées d'un filet. Le titre du
  groupe s'écrit en bas de casse, au-dessus.
- **Une ligne dit où elle mène et ce qui y est réglé.** Au bout, avant le
  chevron : « Océan · Système », « Français », « 2 rappels », « Rav Posen ».
  On lit l'état sans ouvrir la page. Ce qui ne va pas le dit à la place du
  nombre : des notifications bloquées par le téléphone s'annoncent
  « Bloquées », en ambre.
- **Trois formes, une allure.** Une page de l'app (chevron), une action sur
  place (sans chevron : rien ne s'ouvre derrière, « Revoir l'introduction »),
  la déconnexion (en rouge). Chaque ligne fait au moins 52 px de haut et
  répond au toucher par un fond, faute de survol.
- **La déconnexion pose la question, dans l'app seulement.** Sur le site,
  c'est un bouton à part ; ici, une ligne parmi d'autres, qu'un pouce touche
  par mégarde en visant sa voisine, et se reconnecter demande un mot de passe
  et le réseau. Elle ne part donc pas sans retour, mais son retour coûte trop
  pour la règle « ce qui se refait d'un geste ne se confirme pas ».
- **Les sous-pages sont de vraies pages** (`NativeProfileSection.vue`,
  `/profile/appearance`, `/profile/language`, `/profile/notifications`,
  `/profile/preferences`, et pour un compte `/profile/account`,
  `/profile/security`) : leur adresse, leur retour Android, leur glissement
  iOS. Un lien discret en haut (« Profil », ou « Réglages » sans compte)
  remonte l'historique plutôt que d'en empiler, et le titre est centré. Elles
  reprennent les réglages du site tels quels : seule la façon d'y arriver
  change. L'onglet de la barre du bas reste allumé dessus (`activeOn`).
- **La langue a sa ligne.** Sur le site, elle ouvre l'onglet Apparence ; dans
  l'app, on la change rarement, et trois langues se lisent mieux en liste
  cochée qu'en tuiles (`AppearanceSettings`, `with-language` à faux).
- **L'identité en tête, sans bandeau.** Connecté : un rond à l'initiale, de la
  couleur du thème (la seule touche pleine de la page), le nom, l'adresse et
  « Modifier mon profil ». Sans compte : le titre « Réglages » et une carte
  qui propose le compte, deux boutons, sans insister.
- **Le pied de page du site finit la page,** en petit : qui fait l'app, ses
  réseaux et la version installée, qu'on demande à qui écrit pour un bug.

Le test `nativeProfile.test.ts` tient la page : ce qui paraît avec et sans
compte, les sous-pages où mène chaque ligne, l'état porté au bout.

### Ce qui ne se modifie pas n'a pas l'air d'un champ

Un cadre de champ (`.field`) promet qu'on peut écrire dedans. Dans le profil,
l'adresse email et l'identifiant du compte en portaient un sans pouvoir se
modifier, et ils étaient touchés à répétition (audit PostHog d'octobre 2026,
2.7). Ils se lisent désormais comme un texte, sous leur étiquette ; seul le
nom affiché garde son champ, puisqu'il se modifie. L'identifiant se
sélectionne d'un appui, pour qui doit le copier en écrivant à l'équipe.

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

### La pastille du défilement est son propre arrêt

Pendant une descente automatique, une pastille au bas de l'écran
(`AutoScrollPill.vue`) dit que la page avance toute seule, et c'est le seul
signe qu'elle en donne. Un appui l'ouvre sur l'allure, le suivant arrête.

C'est la règle du menu de lecture, juste au-dessus : ce qu'on a touché pour
ouvrir est ce qu'on touche pour en finir, au même endroit. L'arrêt était une
ligne de plus dans le panneau, sous les allures, c'est-à-dire là où l'on ne
pense pas à revenir quand on veut simplement que cela cesse. Un appui à côté
referme le réglage sans rien arrêter : fermer et arrêter ne sont pas le même
geste, et c'est au geste le plus large de ne rien faire.

L'allure se règle à un curseur à crans, du plus lent à gauche au plus rapide à
droite, et non dans une liste d'intitulés. Une liste demande de lire chaque
ligne pour comprendre qu'elles forment une échelle ; un curseur le montre, et
se pousse du pouce sans viser une ligne. Les crans sont les allures
elles-mêmes, dessinés sous le rail à l'aplomb des positions du curseur : un
rail lisse promettrait un réglage continu qui n'existe pas. Les deux bouts
portent le nom des allures extrêmes, parce que ce sont elles. En hébreu, le
rail se retourne avec la page, et le plus lent passe à droite.

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
en fin de parcours : le pied de page du site, le profil de l'app (groupe Aide), et
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

### L'équipe prend la parole quand elle a quelque chose à dire

Les informations de l'équipe (une nouveauté, un incident, une question, voir
`docs/informations.md`) n'ont pas de place réservée sur l'accueil. Une carte
n'y apparaît que lorsqu'il y a du nouveau, et elle se range en tête des
raccourcis du moment, à côté de la salutation : un incident explique
peut-être ce qui ne marche pas plus bas, il se lit avant.

Elle a deux formes. Pas encore lue, l'annonce se montre en aperçu : sa nature
en pastille, « Nouveau » en pastille pleine, le titre en gras et deux lignes du
texte, de quoi savoir de quoi il s'agit sans l'ouvrir, puis « Lire la suite ».
Lue, elle se réduit pendant une semaine à la forme des autres raccourcis (un
dessin, une ligne, une précision en petit) : on sait que l'équipe a parlé, et
elle ne prend plus la place d'une nouvelle. Son dessin est une cloche, ou,
pour un incident, le triangle ambré des avertissements.

Le reste du temps, la liste reste à un lien, en bas de l'accueil, juste
au-dessus de « Écrivez-nous » : l'une donne des nouvelles, l'autre en
demande, les deux vivent à la fin du parcours. Sur la page elle-même, chaque
annonce est une carte (elle répond à « qu'est-ce qui a changé ? »), avec sa
nature en pastille et « Nouveau » en pastille pleine, calculé sur la visite
précédente.

### La chaîne perpétuelle se confie un nom, elle ne se crée pas

La chaîne perpétuelle de Tehilim (`docs/chaine-perpetuelle.md`) est la seule
chaîne qu'on peut toujours rejoindre. Sur l'accueil du partage, elle se
pose sous le bouton de création (`PerpetualChainCard`), dans une carte comme
celles des autres chaînes : un cadre blanc, cliquable tout entier, dont le
titre prend la couleur au survol. Elle ne prend pas la couleur du thème en
aplat : sur une page de chaînes, une carte pleine se lisait comme une
publicité au milieu des autres. La couleur ne marque que ce qui la distingue,
« Toujours ouverte », le chiffre en avant et la barre d'avancement. Ce
chiffre, au bout de la ligne, est le nombre de fois qu'elle a été terminée ;
au premier tour, il n'y a rien à compter, et il ne paraît pas.

La carte ne nomme personne : « On y lit pour 5 personnes ». Les noms sont
ceux de malades et de défunts ; ils se lisent sur la page de la chaîne, où
l'on vient pour eux, et non en passant sur l'accueil.

Sur sa page, l'en-tête dit « Lecture continue » et le tour en cours là où une
chaîne ordinaire dit sa date limite et son créateur. Viennent ensuite le
compteur (un seul chiffre en grand, trois en dessous qui le servent), puis
« Pour qui l'on lit », avant le tirage : on dit les noms avant de lire. Une
ligne les suit, en petit : un Téhilim réservé se lit dans les 24 heures, puis
redevient libre. Personne ne possède la chaîne pour libérer une place
oubliée ; autant le dire à qui réserve.

Les noms courent à la suite, séparés d'un point médian, comme une dédicace,
et non en lignes : vingt lignes auraient repoussé la lecture sous trois
écrans. Huit par groupe, le reste se déplie. Deux groupes, que le dessin
distingue : le cœur pour une refoua chelema, la bougie pour un leilouy
nichmat (celle des dates du calendrier). Un nom ne se coupe pas d'une ligne à
l'autre (`whitespace-nowrap`).

Les noms du lecteur sont des pastilles à la couleur du thème, avec un crayon,
en tête de leur groupe : ce sont les seuls qui s'ouvrent, et c'est la règle
des pastilles (« une pastille énonce, sauf celle qui porte une icône, qui
ouvre »). Ceux qui ne sont pas lus en ce moment (échus, ou un défunt hors de
la semaine de son anniversaire) restent à portée de leur auteur, en pastilles
grises sous la liste.

La fenêtre « Proposer un nom » compose le nom comme on le dit : les deux
prénoms côte à côte, et entre eux « ben » ou « bat », qui suit le choix homme
ou femme sous les yeux. Un aperçu montre la ligne telle qu'elle paraîtra. Pour
un leilouy nichmat, la date du décès se choisit comme une date du calendrier
(jour, mois hébraïque), et la phrase sous les champs dit, avant même qu'on
la choisisse, ce que la date change : sans elle, le nom est lu trente jours ;
avec elle, il revient tous les ans, la semaine qui précède l'anniversaire.

« Signaler », sur la chaîne, vise un nom : le bouton ne s'éteint pas après
un premier signalement, et la fenêtre demande le nom en cause au lieu de
promettre un masquage au troisième. La case « Bloquer ce créateur » n'y paraît
pas : le créateur est l'équipe, la bloquer effaçait la chaîne de l'appareil.

Dans le lecteur, « Vous lisez pour » garde les deux groupes de la page de la
chaîne, chacun avec son dessin : on ne dit pas de la même façon une refoua
chelema et un leilouy nichmat (`PrayerNamesLine`). Retirer un nom pose la
question, avec le nom (`useConfirm`) ; le prolonger, non : cela se refait
d'un geste.

À la création d'une session de Tehilim, la chaîne perpétuelle se propose en
une ligne discrète sous le type, en petit : elle ne détourne pas de la
création, et ne promet pas de chiffre de lecteurs qu'on ne connaît pas.

### Le backoffice est un outil, et il se lit comme un tableau de bord

Le backoffice (`/admin`) ne sert qu'à l'équipe, sur un écran d'ordinateur le
plus souvent. Il garde la charte (le beige, les surfaces sans bordure, les
commandes rondes, Playfair pour les titres de section) mais pas la mise en
page des pages publiques : ses titres sont alignés à gauche, ses listes sont
denses, et il va droit à ce qui attend une décision.

- **Il s'ouvre sur une vue d'ensemble** : quatre chiffres (chiourim en ligne,
  écoutes, sessions, auteurs), puis « À traiter », une liste de lignes qui
  mènent chacune à la liste déjà filtrée (`?filtre=draft`). Quand il n'y a
  rien à traiter, la page le dit en une phrase, avec une coche verte.
- **Les onglets comptent ce qui attend** : une pastille couleur du thème pour
  un travail en attente (chiourim à relire), rouge pour un problème
  (sessions signalées, incident en cours).
- **Une liste est un seul panneau** de lignes séparées d'un filet, et non une
  pile de cartes : on la parcourt d'un regard. Ses filtres sont des pastilles
  qui portent leur compte ; le filtre actif prend la couleur pleine.
- **Les états ont cinq tons, toujours les mêmes** (`AdminStatus`) : vert pour
  ce qui est en ligne, ambre pour ce qui attend (brouillon, à relire), rouge
  pour ce qui est retiré ou signalé, la couleur du thème pour une nature, gris
  pour un détail. Une pastille d'état énonce ; elle ne se touche pas.
- **Le geste courant est un bouton, pas la pastille** : « Publier » à côté
  d'un brouillon. Dépublier, plus rare et plus lourd, reste sur la fiche ou
  dans le traitement en masse, derrière une confirmation.
- **Une sélection fait apparaître sa barre en bas de l'écran**, qui reste à
  portée pendant qu'on coche, et disparaît quand on la vide.
- **Une fiche met en tête ce qu'on vient vérifier** : pour un chiour, le
  lecteur audio, puis le contenu à gauche et le rangement à droite. Ce qui
  supprime est en bas, en rouge, jamais à côté d'« Enregistrer ».

### Une chaîne courte se confirme

Une date limite qui tombe ce soir ou demain soir (`services/sessionDeadline.ts`)
ne s'interdit pas : une veillée, une refoua chelema urgente tiennent en un
jour. Mais en septembre 2026, trois chaînes sur neuf avaient pour date
limite le jour même de leur création, et deux sont restées vides. Le bouton
« Créer » pose donc d'abord la question (`useConfirm`) : « Attention, votre
date semble proche d'aujourd'hui », la fin dite en clair (ce soir, demain
soir). « Oui, créer la session » crée ; « Changer la date » ramène au champ.
Au-delà de demain, rien ne s'interpose. Tenu par
`src/__tests__/newSessionDeadline.test.ts` et `sessionDeadline.test.ts`.

### Une chaîne se partage dès sa création

Une chaîne que personne ne voit reste vide : celles qui se sont remplies
avaient eu de 6 à 24 visiteurs, les vides jamais plus de deux. À la création,
la page de la chaîne s'ouvre donc sur la fenêtre de partage qui existe déjà
(`ShareModal.vue`), titrée « Votre session est prête » et précédée d'une
phrase : penser à la partager autour de soi, pour que d'autres y participent.
Le signal passe par l'adresse (`?partager=1`), retiré aussitôt : un
rechargement ne rouvre pas la fenêtre.

### Les jours restants se comptent sur le calendrier

La pastille de « Je participe » compte les jours du calendrier jusqu'à la
date limite, pas les heures arrondies : « J-1 » la veille, et le jour même
**« Jour J »** (« Last day », « היום האחרון ») plutôt qu'un « J-0 » qui se lit
mal. Chaque langue a ses trois formes, l'hébreu accordant le singulier
(« עוד יום אחד »). Tenu par `src/__tests__/myParticipatedSessions.test.ts`
(« Je participe : jours restants »).

### L'écran de connexion dit quoi faire

Un échec ne montre jamais l'erreur brute de Firebase (« Firebase: Error
(auth/invalid-credential). », en anglais dans une app en français) : chaque
code connu a sa phrase (`describeEmailAuthError`, `services/authErrors.ts`),
et le message brut part seulement vers PostHog, où il sert. Sous la phrase,
**la sortie qui va avec**, une commande avec son dessin et son nom :

- l'adresse ou le mot de passe refusés : « Créer un compte avec cette
  adresse », en gardant ce qui a été saisi. Firebase ne dit pas si l'adresse
  existe ; la phrase couvre donc aussi le compte créé avec Google ou Apple ;
- l'adresse déjà inscrite : « Me connecter avec cette adresse » ;
- la dernière connexion de l'appareil s'est faite avec Google ou Apple : la
  phrase le rappelle, et la sortie est ce bouton-là.

La dernière méthode employée sur l'appareil (`services/lastAuthMethod.ts`)
porte aussi une pastille, **« Dernière utilisation »**, posée sur le bord haut
de son bouton, hors du bouton dont le libellé reste celui de la commande ;
pour l'email, à côté de l'étiquette du champ. Elle survit à la déconnexion :
c'est justement après qu'on en a besoin. Le piège qu'elle évite était le plus
courant de l'écran : un compte créé d'un toucher avec Google, puis, des
semaines plus tard, une adresse et un mot de passe qui n'ont jamais existé.
Tenu par `src/__tests__/loginEmailErrors.test.ts` et `emailAuthErrors.test.ts`.

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

### La sélection prend la couleur du thème

Sélectionner du texte posait derrière lui le bleu du navigateur, la seule
couleur de l'app que personne n'avait choisie, et elle traversait les trois
thèmes sans broncher. `::selection` prend donc `primary` en transparence
(jeton `--color-selection`, dans `main.css`) : le texte garde son encre, seul
le fond change. La transparence est plus appuyée en sombre, où la même teinte,
posée sur du gris nuit au lieu du beige, ne se voyait presque plus.

C'est vrai partout, site et app, et le passage choisi dans un texte reprend
exactement la même teinte (`.reading-selected`) : les deux façons de désigner
du texte se voient pareil.

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
Les réglages ne listent pas les fêtes qui ont un thème, ni ne les montrent en
aperçu : le thème arrive avec la fête, c'est une surprise, pas un catalogue.

| Fête        | Période                                                  | `primary`                | `secondary`         | Bouton des horaires  | Ornements                  |
| ----------- | -------------------------------------------------------- | ------------------------ | ------------------- | -------------------- | -------------------------- |
| Tichri      | du 16 Eloul (deux semaines avant Roch Hachana) à Kippour | `#D8322F` rouge pomme    | `#D9A21B` miel      | une pomme            | un chofar, un pot de miel  |
| Souccot     | du lendemain de Kippour au lendemain de Sim'hat Torah    | `#4E8A2E` vert loulav    | `#D9B324` étrog     | une soucca           | un loulav, un étrog        |
| 'Hanouka    | les huit jours                                           | `#9F7A00` jaune moutarde | `#FFD23F` flamme    | une toupie           | un beignet, une 'hanoukkia |
| Tou Bichvat | le jour même                                             | `#9A4FC0` violet figue   | `#79B043` feuille   | une figue            | une grappe, une figue      |
| Pourim      | de la veille au lendemain                                | `#CC2E70` framboise      | `#F2B705` or        | une meguila          | une crécelle, un masque    |
| Pessah      | d'une semaine avant au lendemain de la fête              | `#2A86A3` bleu de mer    | `#D8B570` matsa     | une matsa            | un verre de vin, une matsa |
| Chavouot    | d'une semaine avant au lendemain de la fête              | `#3F72B8` bleuet         | `#D4A017` or du blé | les tables de la loi | un épi de blé, les tables  |

Trois choses changent, pas une de plus :

- **les couleurs** : le duo de la fête prend la place de `primary` et
  `secondary`, partout où ils servent, widgets et montre compris. Les mêmes
  bornes de lisibilité que les thèmes choisis s'appliquent (voir
  « Lisibilité ») ; le vert de Souccot est pris plus franc et plus jaune que
  l'émeraude, pour qu'on ne les confonde pas ;
- **les ornements** : deux dessins par fête, dans le style des illustrations
  des portes (`src/components/holiday`). En tête de l'accueil, de part et
  d'autre d'un souhait ; à côté du nom du site dans le bandeau et en tête du
  pied de page ; en blanc sur le bandeau du profil ; et, sur toutes les autres
  pages, en filigrane dans les coins hauts (`HolidayBackdrop`), là où le mur
  de pierre se voit, jamais sur une page de lecture. Toujours à même le fond,
  jamais en carte : c'est une parure, pas une réponse. Un ornement qui se
  pose à l'arrivée s'écrit dans `OrnamentPose`, qui porte le trait, la seconde
  couleur (`.accent`) et l'animation : il n'y met que son dessin ;
- **le bouton rond des horaires** de l'app native, dont le rond prend la forme
  d'un objet de la fête (une pomme, une soucca, `HolidayFabShape`), l'horloge
  restant au milieu : c'est toujours le bouton des horaires, il a seulement
  changé d'habit. C'est le bouton que tout le monde touche chaque jour, et
  c'est là que la fête se voit d'abord.

Ce qui passe devant quoi : le survol d'un thème dans les réglages, puis la
fête en cours, puis le thème choisi. Le choix reste le choix
pendant la fête, on le retrouve après. Une fenêtre se compte en jours civils,
pas à la chkia : un thème qui change dans la nuit ne trompe personne, un thème
qui changerait à 19 h 42 le ferait sous les yeux. Le lendemain de Kippour
appartient à Souccot, le jour où l'on commence la soucca.

À 'Hanouka, la 'hanoukkia de l'accueil est vivante (`HanoukkiaLive`) : elle
porte autant de lumières que le soir en compte, la chkia faisant foi comme
pour le compte du 'Omer, et la toucher ouvre le texte de l'allumage. Le jaune
de 'Hanouka est pris en moutarde : un jaune vif ne tient pas en encre sur le
blanc, alors la flamme, vive, est en seconde couleur, là où le jaune se voit.

Les fêtes se comptent comme en diaspora quand le thème doit choisir (la fin
de Souccot, de Pessah, de Chavouot) : le thème ne sait pas où l'on est, et un
jour de plus ne gêne personne. Pourim est celui d'Adar II les années
embolismiques.

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

Le second plan dit autre chose que la couleur du jour. Un passage que l'on ne
dit pas partout (la supplique « Chema' koli » avant Min'ha d'un jeûne, le
léchem yihoud d'Arvit, la seconde liste du vidouy de la veille de Kippour, que
Tunis ne disait pas) se lit en `text-secondary`, sous la note qui l'explique :
le gris montre jusqu'où va le passage dont la note parle, quand la note seule
laisserait chercher. Le fil que l'on lit d'un bout à l'autre garde, lui, sa
pleine encre. Aucune règle ne fixe donc de couleur sur `.reading-he` : elle
vient du bloc ou du paragraphe, et une couleur posée là les couvrirait tous
les deux.

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

### Une prière qui passe par un autre livre y mène d'un geste

Les Hochanot se disent au milieu de Cha'harit, après le Hallel, mais leur
texte vit dans le livre Moadim : il pèse trop pour l'office de tous les
jours. Là où la prière change de livre, le bloc porte un renvoi, une pastille
à la couleur du thème qui porte son dessin et son nom (« Lire les Hochanot du
jour »), posée sous le texte qu'elle prolonge (`.reading-link`, dans
`LiturgyText.vue`). C'est une commande de l'interface : sa taille est celle
des commandes de titre, elle ne suit pas celle du texte lu. La fin des
Hochanot porte le renvoi inverse, qui ramène à Cha'harit au passage qui suit
(le Kaddich Titkabal) et non en haut de l'office. Quand on vient de
Cha'harit, le renvoi y revient au lieu de l'empiler une seconde fois : le
bouton « précédent » ne fait pas la navette entre les deux textes.

### La 'hazara repart du début de la 'Amida

Les passages que le 'hazan dit pendant la répétition (Kedoucha, Modim
dérabanan, Birkat kohanim, 'Anénou) restent repliés dans la 'Amida : on la
prie d'abord à voix basse, et ils couperaient le fil. Quand le 'hazan
reprend, le lecteur est en bas de la 'Amida et doit remonter les déplier un
à un. La fin de chaque 'Amida répétée (Cha'harit, Min'ha, Moussaf ; pas
Arvit) porte donc une pastille « 'Hazara », la même que celle d'un renvoi
(`.reading-link`, dans `LiturgyText.vue`), posée sous « 'Ossé chalom » :
elle remonte au titre de la 'Amida et déplie en chemin les passages du
'hazan, et eux seuls (le Kaddich qui suit reste replié). Le marqueur vient de
la recette (`hazara`, dans `scripts/build-sidour.mjs`) ; un test tient sa
place (`sidourContent.test.ts`), un autre ce que fait le bouton
(`liturgyHazara.test.ts`).

### Un texte qui change avec le jour s'ouvre sur le jour

Un livre qui porte une suite par jour (les Hochanot : six jours, Hochana
Rabba, le Chabbat) n'en montre qu'une, celle du jour du calendrier. Au-dessus
du texte, une rangée de pastilles nomme les jours (`TefilaDays.vue`) : celle
du jour lu est pleine, à la couleur du thème ; celle du jour du calendrier
porte un point, pour qu'on la retrouve après avoir lu un autre jour. Hors de
la fête, le livre s'ouvre sur le premier. Le choix ne se retient pas : rouvrir
le livre, c'est retrouver le jour qu'il est. Une adresse peut nommer le jour
(`?jour=hoshana-rabba`) : le lien de la page de Hochaana Rabba, les anciennes
pages d'un jour, un passage partagé.

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
fenêtres et les panneaux flottants, `rounded-xs` 2 px pour un aperçu posé à
quelques pixels du bord d'une carte. Les commandes ne suivent pas cette
échelle : elles prennent leurs alias.

### Deux arrondis emboîtés ne sont jamais égaux

Un élément posé dans un autre prend le rayon du parent moins son rembourrage
(une coque à 14 px avec 2 px de marge intérieure tient un bouton à 12 px,
arrondi ici à `rounded-control` ; une carte à 6 px avec 4 px de marge tient un
aperçu à 2 px). Deux courbes concentriques de même rayon ne sont pas
parallèles : l'intérieure paraît plus ronde, et l'oeil le voit sans savoir
pourquoi. La règle vaut pour ce qui **épouse** les angles du parent : la
coque d'un groupe segmenté et ses boutons, l'en-tête d'une carte et son fond
de survol, les lignes d'une liste posée dans une carte, un aperçu dans une
carte.

Elle ne vaut pas pour ce qui ne partage pas les angles : un bouton (14 px)
posé au milieu d'une carte (6 px) garde son rayon de commande, c'est le
contraste des deux familles qui le fait lire comme un bouton ; une pastille
ou un rond (999 px) est rond partout, et deux ronds emboîtés sont toujours
concentriques.

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
| le menu d'une sélection   | `ReadingSelectionMenu.vue` sur un texte (voir plus bas)                          |

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

### Sur un texte, le menu de la sélection est le nôtre

Le menu qui surgit d'une sélection (copier, rechercher, traduire, partager)
est une fenêtre du système comme les autres, à ceci près qu'on ne peut pas
l'habiller : sur un téléphone, il s'ouvre par-dessus tout ce qu'on poserait à
côté. Et devant un texte, ce qu'il propose n'est pas ce qu'on veut proposer :
la traduction automatique d'un verset et la recherche web d'un mot d'hébreu.

Les passages d'un texte coupent donc la sélection du système (`.reading-pick`)
et se choisissent d'un appui ; une bulle vient se poser dessus, au-dessus du
passage comme le ferait le menu qu'elle remplace, avec les gestes qui ont un
sens là où l'on est : **partager** ce passage (le lien y ramène, et non en
haut du chapitre), en lire la **phonétique** sans faire basculer toute la
page, **signaler une erreur** (le formulaire de support s'ouvre avec
l'endroit, les premiers mots et le lien déjà écrits), et le **marque-page** là
où le texte en prend.

L'appui long ouvre la bulle, comme l'appui bref. Couper la sélection du
système coupe aussi le geste qui l'ouvrait : sans cela, appuyer longuement sur
un verset ne ferait plus rien du tout, et le geste que tout le monde connaît
pour agir sur du texte serait mort. La bulle se pose au-dessus du passage,
jamais sous la zone système ni sous le bandeau du site (elle passe alors
dessous), et sa rangée de commandes suit la taille de lecture, à moitié comme
le menu de lecture, plafonnée pour que quatre colonnes tiennent sur la largeur
d'un téléphone.

Le choix se fait au passage, jamais au mot : c'est la seule unité que ces
commandes savent nommer. Un lien mène à un verset, pas à trois mots, et un
signalement qui dit « Tehilim 23 · verset 4 » se corrige, là où trois mots
copiés se cherchent. Partout ailleurs (le reste du site, un texte qu'on
accompagne sans qu'il ait d'adresse à lui), la sélection ordinaire reste, à la
couleur du thème.

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

### Une confirmation passe devant la fenêtre qui la demande

La question de `useConfirm` (« Retirer ce nom de la liste ? ») se pose
souvent depuis une fenêtre déjà ouverte. Sa boîte (`ConfirmDialog`) est
montée une fois pour toutes dans `App.vue`, donc avant toutes les autres :
au même rang (60), la fenêtre ouverte ensuite la recouvrait, et la question
restait invisible sous elle. Elle se pose donc un cran au-dessus (65), sous
l'accueil du premier lancement (90) et les toasts (100). Le test de bout en
bout de la chaîne perpétuelle (`e2e/firebase/perpetualChain.spec.ts`, le
retrait d'un nom) la tient.

## 7. Le bandeau de navigation

Sur le **web**, le bandeau est transparent tant qu'on est en tête de page : il
laisse voir le beige et ne pèse rien. Dès le premier geste de défilement, il
prend un fond translucide et flouté, sans quoi le contenu se lirait à travers
les liens. Sur **mobile**, il est compact : le titre passe au corps courant,
la baseline disparaît, les marges verticales sont réduites de moitié. Le
bandeau publie sa hauteur réelle dans `--navbar-height`, dont dépendent les
barres collantes des pages.

L'app native n'a pas de bandeau : la navigation y passe par la barre du bas
(`BottomTabBar`). Comme sur iOS et Android, toucher l'onglet de la page où
l'on est la remonte en haut (en douceur, sauf si le système demande moins
d'animations) ; depuis une sous-page, il ramène à la page de l'onglet. Tenu
par `src/__tests__/bottomTabBar.test.ts`.

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
- Le zoom au double appui du navigateur, sur le site comme dans l'app : le
  pincement fait ce travail et reste entier. Le double appui, lui, est un geste
  à nous (il lance le défilement automatique sur un texte) ; là où le navigateur
  zoomait en même temps, les deux se disputaient la page.

## 9. Ce qui reste à faire

Cette charte est en cours d'écriture, au fil des décisions.

- Un jeton d'encre distinct de `--color-primary`, si l'on veut des couleurs
  plus vives sans perdre les liens et les numéros de verset.
- L'icône de l'app porte encore le bleu d'avant : elle se reprendra plus tard.
  Les captures des fiches des stores se régénèrent à la prochaine CI.
