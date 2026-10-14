# Mon parcours

Ce qu'on se donne à tenir, et ce qu'on a tenu : finir un texte pour une date,
une habitude, les Tehilim du mois, la paracha de la semaine, un texte relu
chaque jour. La lecture du jour d'avant y est entrée : ses textes et ses
lectures du calendrier sont des objectifs comme les autres.

Ce document dit comment c'est fait. Le dessin est dans `docs/design.md`
(« Mon parcours : le mur se bâtit en pierres, et seulement lui » et les
sections qui suivent), le suivi d'audience dans `docs/tracking-plan.md`
(« Mon parcours »).

## Les pages

| Adresse                           | Ce qu'on y trouve                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `/`                               | l'accueil : la lampe, le paquet du jour, le portefeuille, l'étagère (`components/parcours/home/`) |
| `/parcours`                       | la série, le mur des cinq dernières semaines, l'étagère, les habitudes                            |
| `/parcours/journee`               | Ma journée, rangée par moments ; `?jour=` pour un jour passé                                      |
| `/parcours/mur`                   | le mur entier                                                                                     |
| `/parcours/nouveau`               | nouvel objectif, en étapes gardées dans l'adresse (`?etape=`)                                     |
| `/parcours/objectif/:id`          | un programme (sa portion, son retard, sa semaine), ou les réglages d'un autre objectif            |
| `/parcours/objectif/:id/reglages` | les réglages d'un programme                                                                       |
| `/bibliotheque/lecture-du-jour`   | l'adresse d'avant : elle mène à Ma journée                                                        |

Dans l'app, tout s'ouvre **sans compte** et hors ligne. Le site demande un
compte : il n'a pas d'appareil où garder le suivi.

Une lecture ouverte depuis le parcours porte `?objectif=` : le lecteur montre
alors, au bas du texte, la tâche du jour à cocher (`ReaderTaskCard.vue`).

## Le modèle

`src/services/parcours/`, sans Vue :

| Fichier                                    | Rôle                                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `model.ts`                                 | les objectifs (programme, habitude, cycle, texte du jour) et les journées                |
| `texts.ts`                                 | ce qu'un programme peut finir et ce qu'il compte, d'après `src/datas/parcoursUnits.json` |
| `plan.ts`                                  | la portion de chaque jour ou semaine, le retard, le rattrapage                           |
| `schedule.ts`                              | les tâches d'un jour, l'état d'un jour sur le mur, la série                              |
| `calendar.ts`                              | les jours de repos (Chabbat, les fêtes, en Israël ou en diaspora)                        |
| `moments.ts`                               | le moment présent, l'ordre du paquet de l'accueil                                        |
| `actions.ts`, `create.ts`                  | ce qu'on change, ce qu'on crée                                                           |
| `merge.ts`                                 | la fusion de deux copies                                                                 |
| `deviceStore.ts`, `cloud.ts`, `account.ts` | l'appareil, le compte, ce qui passe de l'un à l'autre                                    |
| `legacyDailyReading.ts`                    | la lecture du jour d'avant                                                               |
| `entries.ts`                               | les textes qu'une tâche fait lire (le téléchargement hors ligne)                         |
| `tracking.ts`                              | le suivi d'audience commun à plusieurs écrans                                            |

`composables/useParcours.ts` réunit le tout pour les pages : un seul état
partagé, démarré au premier usage (qui n'ouvre jamais le parcours ne charge
rien).

**Une journée** (`DayLog`) garde ce qui est fait (`done`), les unités lues
par programme (`units`), ce qui est mis de côté (`skipped`) et l'heure de la
dernière écriture (`at`). **Un objectif** garde sa propre heure
(`updatedAt`) ; retiré, il reste en pierre tombale (`deletedAt`) : les jours
passés gardent leur pierre, et un autre appareil apprend qu'il est parti.

**Un programme** garde ses textes et son total d'unités ; sa position se
déduit des journées. Son pas repart d'une base (`base` : un jour et une
position) quand on change sa date ou son rythme. Un rattrapage ajoute des
unités à des créneaux (`extra`), « Déjà fait » avance la position
(`credit`).

**Les unités** (michnayot, côtés de daf, chapitres, psaumes) viennent de
`src/datas/parcoursUnits.json`, que `scripts/parcours-units.mjs` écrit à
partir de `public/texts/` ; `--check` vérifie qu'il est à jour
(`parcoursUnits.test.ts`). Un texte corrigé sans que ce fichier suive
décalerait toutes les portions d'après.

## Le stockage

**L'appareil est le socle.** Tout vit dans `localStorage` (clé
`pj-parcours`), doublé dans les Preferences de Capacitor dans l'app, que le
système ne vide pas avec le stockage de la webview : `{ data, owner, dirty }`.
Sans compte, c'est complet ; changer d'appareil sans compte perd le suivi, et
la page de Mon parcours le dit.

**Le compte emporte tout d'un appareil à l'autre.** Le document
`parcours/{uid}` porte deux tables, `objectives` et `days` ; chaque
changement s'y écrit entrée par entrée (`setDoc` avec `mergeFields`), jamais
le document entier, pour ne pas écraser ce qu'un autre appareil a écrit.
Les règles Firestore (`match /parcours/{userId}`) n'ouvrent le document qu'à
son propriétaire, bornent les clés et la taille des tables.

**On n'écrit jamais d'après une copie qu'on n'a pas relue.** À la connexion,
au retour du réseau et au retour à l'écran après cinq minutes, le compte se
relit depuis le serveur (pas depuis le cache), se fusionne avec l'appareil
(`mergeParcours` : entrée par entrée, la plus récente l'emporte, les sortes
d'objectifs inconnues sont gardées telles quelles), puis ce qui diffère part.
Une écriture qui échoue reste à faire (`dirty`) et repart après la relecture
suivante.

**Un appareil partagé** : à la connexion, l'appareil verse dans le compte ce
qui n'appartient à personne, ou à ce compte ; s'il suivait un autre compte,
seulement ce qui a été fait depuis la déconnexion de celui-ci (`account.ts`,
`owner.leftAt`). À la déconnexion, tout reste sur l'appareil.

**La suppression du compte** efface aussi `parcours/{uid}`
(`authService.deleteAccount`, `accountDeletion.test.ts`).

## La lecture du jour d'avant

Elle vivait dans `userPreferences/{uid}` : `dailyReadingIds`,
`dailyReadingOptions`, `dailyReadingProgress`. Les versions de l'app déjà
installées les lisent et les écrivent encore, comme le rappel du soir
(`functions/src/dailyReminder.ts`). Mon parcours les reprend sans les
remplacer (`legacyDailyReading.ts`) :

- **à la connexion**, chaque texte devient un objectif `daily-text-<id>`, les
  Tehilim du jour `daily-tehilim`, la paracha `daily-parasha` : des
  identifiants tirés d'eux, les mêmes sur tous les appareils, qui ne se
  doublent pas. Ce qui était lu aujourd'hui y est coché. Les listes d'avant ne
  font qu'ajouter ;
- **à chaque changement**, Mon parcours réécrit ces champs d'après lui
  (`legacyProjection`), listes et journée chacune de son côté, seulement si
  elles changent.

Les **widgets et la montre** tirent la lecture du jour de l'appareil, avec ou
sans compte (`widgetService`) ; un compte que l'appareil n'a pas encore repris
garde celle de son profil.

Le **rappel du soir** ne compte que les textes du jour et les lectures du
calendrier, comme avant : il lit le profil, côté serveur, et ne sait rien des
programmes ni des habitudes.

## Les tests

| Test                            | Ce qu'il tient                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `parcoursUnits.test.ts`         | les unités des programmes suivent `public/texts/` (garde-fou, voir `docs/tests.md`)       |
| `parcoursPlan.test.ts`          | les portions, le retard, les cinq rattrapages                                             |
| `parcoursSchedule.test.ts`      | les tâches d'un jour, le mur, la série (Chabbat et « Pas aujourd'hui » ne la coupent pas) |
| `parcoursCalendar.test.ts`      | les jours de repos, les moments, l'ordre du paquet                                        |
| `parcoursMerge.test.ts`         | la fusion de deux copies                                                                  |
| `parcoursSync.test.ts`          | sans compte, avec un compte, un appareil partagé                                          |
| `parcoursLegacyDaily.test.ts`   | la lecture du jour d'avant, reprise et tenue à jour                                       |
| `parcoursDeck.test.ts`          | le paquet de l'accueil                                                                    |
| `parcoursEntries.test.ts`       | les textes à télécharger pour la journée                                                  |
| `parcoursTracking.test.ts`      | le suivi commun, et les événements de la lecture du jour qui continuent                   |
| `widgetDailyParcours.test.ts`   | la lecture du jour des widgets, sans compte                                               |
| `e2e/firebase/parcours.spec.ts` | un texte du jour pris, coché, et suivi par le compte (émulateurs)                         |
