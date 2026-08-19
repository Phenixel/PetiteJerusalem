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
  Un appareil ne peut signaler une session qu'une fois (mémorisé localement).
- **Blocage d'un créateur** (case à cocher dans la modale de signalement) :
  ses sessions disparaissent des listes sur cet appareil, déblocage possible
  depuis la page de la session.
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
  et **Supprimer** (la session et ses signalements).

## Sécurité (règles Firestore)

- Le créateur ne peut pas toucher aux champs de modération de sa session
  (`hidden`, `hiddenAt`, `hiddenReason`, `reportsCount`) : seuls l'admin et la
  Cloud Function (SDK admin) le peuvent.
- Une session masquée n'accepte plus de réservations.
- `reports` : création ouverte à tous mais strictement bornée (champs imposés,
  motif dans une liste fermée, session cible existante, identité du signaleur
  cohérente avec l'authentification) ; lecture et traitement réservés à
  l'admin.
- Les aperçus sociaux (`socialPreview`, `ogImage`) ne servent plus les
  sessions masquées.

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
