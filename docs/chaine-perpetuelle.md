# La chaîne perpétuelle de Tehilim

Beaucoup créent une chaîne de Tehilim pour un malade ou un défunt et ne
trouvent pas 150 lecteurs. La chaîne perpétuelle leur répond : une chaîne
toujours ouverte, que tout le monde fait avancer, et qui repart du premier
Téhilim dès que le dernier est lu. On n'y crée rien : on y confie un nom.

Les écrans sont dans le canevas de la proposition (accueil du partage, page
de la chaîne, fenêtre « Proposer un nom », lecture, création d'une session) ;
leurs règles d'apparence sont dans `docs/design.md`, « La chaîne perpétuelle ».

## Ce que voit le lecteur

- **Sur l'accueil du partage**, la chaîne a sa carte en tête, sous le bouton
  de création (`PerpetualChainCard`), un cadre comme les autres chaînes. Elle
  dit pour combien de personnes on lit, sans les nommer. Elle ne figure pas
  dans « Sessions en cours » : elle ne s'y répète pas.
- **Sur sa page**, la même que celle d'une session (`DetailSession`), avec
  trois différences : l'en-tête dit « Lecture continue » et le numéro du tour
  au lieu de la date limite et du créateur ; le compteur des tours
  (`PerpetualStatsCard`) ; la liste des noms pour lesquels on lit
  (`PrayerNamesCard`). Le tirage, la barre d'avancement, la réservation sans
  compte et la liste des 150 Tehilim sont ceux de toute chaîne.
- **Dans le lecteur**, sous la réservation d'un Téhilim de la chaîne : « Vous
  lisez pour », et les noms en deux groupes, refoua chelema et leilouy
  nichmat (`PrayerNamesLine`).
- **À la création d'une session**, dès que le type Tehilim est choisi, une
  ligne discrète propose aussi d'y confier le nom
  (`?proposer=1` ouvre la fenêtre en arrivant). Elle ne promet pas de chiffre
  de lecteurs.

## Les noms

Proposer un nom demande un compte : c'est lui qui permet d'y revenir pour le
prolonger, le corriger ou le retirer. Sans compte, l'invitation à se
connecter (`SignupPromptModal`, variante `prayer_name`).

Un nom se compose comme on le dit : « David ben Sarah », « Rivka bat Léa » ;
homme ou femme décide du mot du milieu. Il porte l'intention : refoua
chelema, ou leilouy nichmat. Deux façons d'être lu :

| Nom                                   | Lu                                                                                | Champs                                      |
| ------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------- |
| Sans date (refoua, ou défunt)         | 30 jours, prolongeables d'un geste (« Prolonger »)                                | `expiresAt`                                 |
| Leilouy nichmat avec la date du décès | Chaque année, la semaine qui précède l'anniversaire hébraïque, jusqu'au jour même | `deathDay`, `deathMonth`, `expiresAt: null` |

La date se place dans l'année par les règles du calendrier
(`services/hebrewOccasions`) : un décès d'Adar revient en Adar II une année
embolismique, un 30 'Hechvan ou Kislev revient le 29 les années où le mois
n'en a que 29. La fenêtre est celle de l'accueil pour les dates du calendrier
(7 jours, `ANNIVERSARY_WINDOW_DAYS`).

Un nom échu, ou un défunt hors de sa semaine, n'est plus lu ; son auteur le
retrouve sous la liste (« Vos noms qui ne sont pas lus en ce moment ») pour le
prolonger ou le retirer. Un compte tient dix noms au plus
(`MAX_NAMES_PER_OWNER`) ; un prénom, 40 caractères. Le filtre de termes
interdits s'y applique, comme aux noms d'invités.

## Les données

La chaîne est une session ordinaire, `sessions/chaine-perpetuelle` (son slug
est le même), créée par `node scripts/admin.mjs chaine:creer`. En plus des
champs de toute session :

| Champ                   | Écrit par               | Rôle                                                    |
| ----------------------- | ----------------------- | ------------------------------------------------------- |
| `perpetual: true`       | `chaine:creer`          | Ce qui la distingue.                                    |
| `slotCount`             | `chaine:creer`          | Les places d'un tour (150) : ce que la fonction compte. |
| `cycle`                 | création, puis fonction | Le tour en cours, à partir de 1.                        |
| `completedCycles`       | fonction                | Tours terminés depuis l'ouverture.                      |
| `cycleStartedAt`        | création, puis fonction | Début du tour en cours.                                 |
| `lastCycleStartedAt`    | fonction                | Début du dernier tour terminé.                          |
| `lastCycleEndedAt`      | fonction                | Sa fin.                                                 |
| `lastCycleParticipants` | fonction                | Ses lecteurs distincts (comptes et invités).            |

Les noms vivent dans `sessions/chaine-perpetuelle/names/{id}` :
`ownerId`, `gender` (`male`, `female`), `firstName`, `motherName`, `kind`
(`refoua`, `leilouy`), `createdAt`, `updatedAt`, `expiresAt`, et pour un
défunt daté `deathDay` (1 à 30) et `deathMonth` (mois hebcal, Adar gardé en
`ADAR_I`).

### Les règles Firestore

- Noms : lecture publique ; création par un compte, en son nom (`ownerId`),
  sur une session `perpetual` seulement ; modification et suppression par
  leur auteur, suppression aussi par l'admin. Les champs sont fermés et
  bornés (`validPrayerName`) : soit une échéance à 31 jours au plus, soit un
  leilouy nichmat daté sans échéance.
- Session : les lecteurs n'y écrivent que le tableau des réservations, comme
  partout. Le drapeau `perpetual`, `slotCount` et le compteur sont réservés à
  `chaine:creer` et à la Cloud Function (SDK admin) : aucun compte ne les pose
  à la création d'une session ni ne les change sur la sienne
  (`perpetualFields`). Sans cela, une session quelconque portant `perpetual`
  prendrait la carte de la chaîne sur l'accueil et échapperait au masquage du
  troisième signalement.

## La fin d'un tour

`onPerpetualSessionUpdated` (`functions/src/perpetualChain.ts`) se déclenche
à chaque écriture d'une session et sort aussitôt de celles qui ne sont pas
perpétuelles. Quand chaque place a une réservation lue
(`isRoundComplete`, `functions/src/perpetualRound.ts`), elle vide les
réservations et avance le compteur (`nextRound`), dans une transaction qui
relit la session : sa propre écriture, ou une relance, ne compte jamais deux
fois le même tour. Sans `slotCount` valide, le tour ne finit jamais : mieux
vaut une chaîne qui ne repart pas qu'une chaîne vidée par erreur.
Seules les places de la chaîne comptent : les Tehilim du catalogue, de
`PERPETUAL_FIRST_TEXT_ID` (103) à 102 + `slotCount`. Les règles laissent
chacun ajouter des réservations ; cent cinquante identifiants inventés, marqués
lus, finissaient le tour en deux écritures. Tests : `perpetualChain.test.ts`
(« ne compte que les places de la chaîne », « suit le catalogue »).

La page qui voit tout lu le dit (« Tour terminé ! »), puis relit la chaîne
jusqu'à voir le tour suivant (`waitForNextRound`, `services/perpetualChain`) :
cinq essais, de plus en plus espacés, une quarantaine de secondes en tout
(`NEXT_ROUND_RETRY_DELAYS_MS`). La fonction répond d'habitude dans la seconde,
mais un démarrage à froid peut prendre plusieurs secondes : un seul
rechargement, cinq secondes après, laissait alors la page figée sans carte de
tirage. L'attente est bornée, et se coupe quand on quitte la page.

Le lecteur fait de même. « Un autre Téhilim » tire dans la copie de la chaîne
chargée à l'ouverture du texte ; quand elle n'a plus de place libre, il relit
la chaîne avant de dire qu'il n'y a plus rien. Si le tour y est entièrement
lu (le lecteur vient de lire le dernier Téhilim), il le dit et attend le tour
suivant de la même façon, puis tire dans celui-ci.

## Une place réservée tient un jour

Sur une chaîne ordinaire, le créateur libère une place réservée puis oubliée.
Personne ne possède la chaîne perpétuelle : une seule place abandonnée
arrêterait le tour à 149 sur 150, pour de bon. La même fonction donne donc une
échéance à toute réservation non lue qui n'en porte pas (`withHoldExpiry`,
24 heures, `PERPETUAL_HOLD_MS`). C'est l'échéance que l'app connaît déjà pour
le tirage (`expiresAt`) : passée, la réservation est ignorée de tous les
affichages et cède sa place à la suivante, dans les versions déjà installées
comme dans celle-ci, et quelle que soit celle qui a réservé. Un tirage garde
son heure, que l'app repousse tant qu'on lit ; une place lue n'a plus
d'échéance. La page de la chaîne le dit en une ligne (`perpetual.holdNote`).
Une échéance plus lointaine que ce jour (posée à la main par un client), ou
qui ne se lit pas comme une date, revient à un jour : sans quoi elle tenait la
place sans fin. Test : « ramène à un jour une échéance plus lointaine, ou
illisible ».

Une échéance ne désigne donc plus un tirage, sur cette chaîne. Le lecteur ne
rend, quand on le quitte sans lire, que ce qu'il a lui-même tiré, jamais une
place réservée à la main (`e2e/firebase/perpetualDraw.spec.ts`).

La règle compte une place par texte : elle ne vaut que pour des textes d'une
seule section, ce que les 150 Tehilim sont. `chaine:creer` refuse un catalogue
qui changerait ce fait.

## La compatibilité

Une app installée avant cette version lit la chaîne comme une session de
Tehilim ordinaire : elle l'affiche dans la liste, avec sa date limite
lointaine (1er janvier 2100, `PERPETUAL_DATE_LIMIT`), et y réserve comme
ailleurs. Rien de ce qu'elle lit n'a disparu ; elle ignore les champs
nouveaux et les noms.

## La modération

Les noms sont du contenu public écrit par les utilisateurs (règle 1.2 de
l'App Store, voir `docs/moderation.md`) : filtre de termes à la saisie,
signalement par le bouton « Signaler » de la chaîne (les précisions nomment
le nom ; on peut en signaler un autre ensuite, et le créateur, l'équipe, ne
s'y bloque pas),
retrait par l'admin (`node scripts/admin.mjs chaine:noms`, puis
`chaine:retirer-nom <id>`). La chaîne elle-même ne se masque pas toute seule
au troisième signalement : trois comptes suffiraient à la retirer à tout le
monde, alors qu'un signalement y vise un nom.

## Ce qui est tenu par un test

`src/__tests__/perpetualChain.test.ts` : la forme d'un nom (ben, bat), quand
un nom est lu (échéance, semaine de l'anniversaire, passage d'une année à
l'autre), l'ordre de la liste, le compteur, la règle de fin de tour et la
remise à zéro, l'échéance d'une place réservée, l'attente bornée du tour suivant
(`waitForNextRound`), le document écrit par `chaine:creer`, et la présence des textes `perpetual.*` dans les trois
langues.

`e2e/firebase/perpetualChain.spec.ts`, contre les émulateurs : la carte, les
noms, la fin d'un tour (la page et le lecteur attendent le tour suivant quand
la fonction tarde), et les règles Firestore (un nom ne s'écrit qu'en son nom et sur la
chaîne ; le drapeau et le compteur de la chaîne ne s'écrivent pas depuis un
compte).
