# Modération des sessions (exigences App Store)

Apple exige, pour toute app dont le contenu est écrit par les utilisateurs
(règle 1.2), un dispositif complet de modération. Les sessions de partage de
lecture (titre, description, noms d'invités) sont concernées. Voici ce qui est
en place et comment s'en servir.

## Ce que voit l'utilisateur

- **Filtre de termes interdits** : titres et descriptions de sessions, pseudos
  à l'inscription et noms d'invités sont refusés s'ils contiennent un terme de
  la liste `src/datas/bannedWords.ts` (comparaison mot à mot, insensible aux
  accents/majuscules et aux chiffres « leet » type `m3rde`). Pour enrichir la
  liste : ajouter le mot en minuscules sans accents dans ce fichier.
- **Bouton « Signaler »** sur la page d'une session (visible pour tout le
  monde sauf le créateur, invités compris) : motif + précisions optionnelles.
  Un appareil ne peut signaler une session qu'une fois (mémorisé localement),
  sauf la chaîne perpétuelle (voir plus bas).
- **Blocage d'un créateur** (case à cocher dans la modale de signalement) :
  ses sessions disparaissent des listes sur cet appareil, déblocage possible
  depuis la page de la session. Pas proposé sur la chaîne perpétuelle.
- **Session masquée** : le public voit un écran « Session masquée » ; le
  créateur voit encore sa session, avec un bandeau d'explication et un badge
  « Masquée » dans « Créées par moi ».

## Masquage automatique

La Cloud Function `onSessionReported` (`functions/src/moderation.ts`) se
déclenche à chaque document créé dans `reports` :

1. elle recompte les signalements **ouverts** de la session, par personne
   distincte (uid ou identifiant invité local) ;
2. elle dénormalise ce compteur dans `sessions.{id}.reportsCount` ;
3. à partir de **3 signaleurs distincts**, elle pose `hidden: true`
   (`hiddenReason: "reports"`), et la session disparaît de l'app publique
   jusqu'à l'intervention de l'admin.

## La chaîne perpétuelle

Les noms confiés à la chaîne perpétuelle (`docs/chaine-perpetuelle.md`) sont
du contenu public : le filtre de termes interdits s'applique au prénom et à
celui de la mère, et seul un compte peut en proposer. Un nom signalé (par le
bouton « Signaler » de la chaîne, le motif le nomme) se retire en ligne de
commande : `node scripts/admin.mjs chaine:noms`, puis
`chaine:retirer-nom <id>`.

Sur la chaîne, le signalement suit cette nature (`moderationService`,
tenu par `src/__tests__/reportPerpetualChain.test.ts` et
`e2e/firebase/perpetualChain.spec.ts`) :

- **on peut signaler de nouveau** (`isReportLocked`) : la chaîne reçoit des
  noms sans fin, et chaque signalement en vise un ; le bouton ne s'éteint pas
  après le premier. La fenêtre le dit, et ses précisions demandent le nom
  visé ;
- **le blocage du créateur n'est pas proposé** (`canBlockCreator`) : son
  créateur est l'équipe (`petite-jerusalem`), et la case retirait toute la
  chaîne de l'appareil. Un blocage posé avant ne la cache plus
  (`isBlockedForViewer`), ni sur sa page, ni sur l'accueil du partage. Pour
  écarter un nom, c'est le signalement, puis le retrait par l'admin.

Les sessions ordinaires ne changent pas : un signalement par appareil, la
case de blocage, le masquage au troisième signaleur.

La chaîne n'est **pas masquée automatiquement** au troisième signalement
(`onSessionReported` la saute) : trois comptes suffiraient à la retirer à tout
le monde, alors qu'un signalement y vise un nom. Le compteur `reportsCount`
monte comme ailleurs, et `session:signalements` la liste.

## Backoffice

`/admin/sessions` (onglet « Sessions » du backoffice) :

- liste de toutes les sessions, signalées et masquées en tête, avec filtres
  (Toutes / Signalées / Masquées) et recherche ;
- détail des signalements ouverts (motif, précisions, date), résolubles un à
  un ;
- **Masquer / Démasquer** : démasquer résout aussi les signalements ouverts et
  remet le compteur à zéro (sinon le signalement suivant re-masquerait la
  session aussitôt) ;
- **Modifier** (corriger un titre/une description problématique sans masquer)
  et **Supprimer** (la session et ses signalements, relus au moment de
  supprimer : un signalement arrivé depuis le chargement de la page restait
  sinon orphelin, compté par la pastille du tableau de bord sans ligne pour
  le traiter ; tenu par `src/__tests__/adminDeleteSessionReports.test.ts`).

## Sécurité (règles Firestore)

- Le créateur ne peut pas toucher aux champs de modération de sa session
  (`hidden`, `hiddenAt`, `hiddenReason`, `reportsCount`) : seuls l'admin et la
  Cloud Function (SDK admin) le peuvent.
- Une session masquée n'accepte plus de réservations, ni d'écriture sur
  celles qu'elle porte. Le rattachement des réservations d'invité à la
  connexion la passe donc, et une session refusée ne bloque pas les
  suivantes (test : `guestMigrationHidden.test.ts`).
- `reports` : création ouverte à tous mais strictement bornée (champs imposés,
  motif dans une liste fermée, session cible existante, identité du signaleur
  cohérente avec l'authentification) ; lecture et traitement réservés à
  l'admin.
- Les aperçus sociaux (`socialPreview`, `ogImage`) ne servent plus les
  sessions masquées.
- Un slug repris par une autre session ne lui donne pas les liens de
  l'original : les règles ne peuvent pas comparer deux documents, c'est donc
  la lecture (`firestoreService.getSessionBySlug`) qui tranche, en faveur de
  la chaîne perpétuelle (son drapeau `perpetual` est réservé à l'admin ; un
  identifiant, lui, se choisit), sinon de la plus ancienne. L'aperçu social
  suit la même règle (`functions/src/sessionSlug.ts`). Test :
  `sessionSlugCollision.test.ts`. Une copie antidatée gagne encore sur une
  session ordinaire : la date de création vient du client, seules des règles
  d'unicité du slug fermeraient ce cas.
- Les champs d'une session sont bornés par `validSessionFields` (titre 300,
  description 5000, slug 200). Le formulaire de création et la fenêtre de
  modification portent les mêmes `maxlength`, et le slug se coupe au dernier
  mot entier avant 180 caractères (`truncateSlug`), ce qui laisse la place
  d'un suffixe de doublon. Un titre long était refusé avec un message
  générique. Tenu par `src/__tests__/sessionLongTitle.test.ts`.

## Conditions d'utilisation et contact

Apple exige aussi, pour le contenu utilisateur, des conditions que
l'utilisateur accepte (avec tolérance zéro affichée pour les contenus
abusifs) et un moyen de contact publié :

- **`/conditions-utilisation`** (fr/en/he, `src/content/seoPages.ts`) :
  règles de publication, clause de tolérance zéro, description du
  signalement/masquage/blocage, engagement d'examen des signalements sous
  24 h. Liée depuis le pied de page, et depuis la page de connexion
  (« En vous connectant ou en créant un compte, vous acceptez… »).
- **Contact** : contact@phenixel.fr, publié sur les conditions, les mentions
  légales, la page À propos et la politique de confidentialité.

## Connexion Apple

« Se connecter avec Apple » est en place (obligatoire dès qu'un login Google
est proposé, règle 4.8), affiché sur iOS uniquement. La suppression de compte
(règle 5.1.1(v)) gère la ré-authentification récente pour les trois types de
comptes : mot de passe, Google et Apple.

Prérequis console : activer le fournisseur **Apple** dans Firebase
Authentication, et la capability **Sign in with Apple** sur l'App ID dans
l'Apple Developer Portal.

## Déploiement

Le dispositif touche trois surfaces, règles Firestore (reports, champs de
modération), Cloud Function `onSessionReported` et app web, et **un tag
`vX.Y.Z` les déploie toutes les trois**, sans geste manuel. Ça n'a pas
toujours été le cas : le compte de service de la CI n'avait longtemps le droit
de publier que le site, et les règles devaient être poussées à la main après
chaque modification. Les droits qui l'ont débloqué sont consignés dans
[docs/firebase-ci-cd.md](firebase-ci-cd.md).

Pour déployer une surface hors release (correction urgente d'une règle,
itération sur la fonction) :

```bash
firebase deploy --only firestore:rules   # nouvelles règles (reports, champs de modération)
firebase deploy --only functions         # onSessionReported (masquage auto)
npm run build && firebase deploy --only hosting   # app (UI de signalement, backoffice)
```
