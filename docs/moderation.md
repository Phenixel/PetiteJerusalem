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

## Connexion Apple

« Se connecter avec Apple » est en place (obligatoire dès qu'un login Google
est proposé — règle 4.8), affiché sur iOS uniquement. La suppression de compte
(règle 5.1.1(v)) gère la ré-authentification récente pour les trois types de
comptes : mot de passe, Google et Apple.

Prérequis console : activer le fournisseur **Apple** dans Firebase
Authentication, et la capability **Sign in with Apple** sur l'App ID dans
l'Apple Developer Portal.

## Déploiement

Le dispositif touche trois surfaces à déployer :

```bash
firebase deploy --only firestore:rules   # nouvelles règles (reports, champs de modération)
firebase deploy --only functions         # onSessionReported (masquage auto)
npm run build && firebase deploy --only hosting   # app (UI de signalement, backoffice)
```
