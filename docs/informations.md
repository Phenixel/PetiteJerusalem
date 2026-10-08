# Les informations de l'équipe

Un moyen de parler aux utilisateurs sans publier de mise à jour : une
nouveauté, les notes d'une version, un incident en cours, une question.
Tout s'écrit depuis le backoffice et s'affiche aussitôt dans l'app et sur le
site.

## Publier

1. Se connecter avec le compte admin, ouvrir **Backoffice → Informations**
   (`/admin/informations`), puis **Nouvelle information**.
2. Choisir la nature :
   - **Nouveauté** : une fonction à découvrir ;
   - **Mise à jour** : les notes d'une version, avec son numéro (`3.11.0`) ;
   - **Incident** : un problème connu, qui reste en tête de l'accueil tant
     qu'il n'est pas marqué « résolu ». S'il se règle par une mise à jour,
     indiquer la version qui le corrige (`3.10.11`) : les appareils qui
     l'ont ne le voient plus sur l'accueil ;
   - **Question** : l'annonce se termine par un bouton « Répondre », qui ouvre
     le formulaire de support déjà amorcé ; la réponse arrive dans la base
     Notion du support, comme les autres messages.
3. Écrire le titre et le texte en français. L'anglais et l'hébreu sont
   facultatifs : sans traduction, ces lecteurs voient le français.
4. Un lien, facultatif : une page de l'app (`/bibliotheque/sidour`) ou une
   adresse externe (`https://…`), avec le texte du bouton.
5. Cocher **Publié**, et **Envoyer une notification** si elle doit partir.
   Une confirmation le rappelle : une notification envoyée ne se rattrape pas.

Corriger une annonce publiée ne la renvoie pas et ne la fait pas remonter :
sa date de publication est fixée à la première publication. Pour clore un
incident, rouvrir l'annonce, cocher « Incident résolu », enregistrer.

## Sans l'interface

Tout ce qui précède se fait aussi en ligne de commande, par Claude, par la CI
ou à la main : `node scripts/admin.mjs info:creer …` (voir
`docs/backoffice-cli.md`). Les notes de version deviennent d'elles-mêmes une
information « Mise à jour » à la publication de la release GitHub.

## Ce que voient les utilisateurs

- **La page Informations** (`/informations`), de la plus récente à la plus
  ancienne, avec une pastille « Nouveau » sur ce qui a été publié depuis la
  dernière visite. On y arrive par le lien en bas de l'accueil, le pied de
  page du site, et l'onglet « À propos » du profil dans l'app.
- **Une carte sur l'accueil**, seulement quand il y a quelque chose :
  - une annonce pas encore lue s'y montre **en aperçu** (sa nature, le titre
    et le début du texte, « Lire la suite »), pendant un mois au plus ;
  - une fois lue, elle reste **une semaine en une ligne**, sauf une note de
    version : lue, elle quitte l'accueil ;
  - un incident en cours passe avant tout et reste jusqu'à ce qu'il soit
    marqué résolu ; lu, il se réduit à une ligne et laisse la dernière
    nouveauté non lue s'afficher en aperçu dessous ;
  - un incident qui porte la version de son correctif ne s'affiche que là
    où cette version manque : une fois la mise à jour faite, il quitte
    l'accueil et n'est plus « Nouveau », lu ou non. Dans la liste, il se lit
    « Résolu », avec « Corrigé dans la version… ». Le site, toujours à la
    dernière version, ne le met jamais en avant.
- **Une notification** dans l'app, qui ouvre l'annonce.

« Déjà vu » se retient sur l'appareil (`pj_announcements_seen`), sans compte.
Au tout premier lancement, seules les annonces des quatorze derniers jours
comptent comme nouvelles.

Les notes d'une version ne s'annoncent sur l'accueil de l'app qu'une fois
cette version installée : publiées pendant la revue des stores, elles
décriraient ce que l'app ne fait pas encore. Elles restent visibles dans la
liste, sans pastille « Nouveau » tant que la version n'est pas là. Une note
vue dans la liste avant l'installation redevient nouvelle une fois la version
installée : l'appareil retient la version de sa dernière visite
(`pj_announcements_seen_version`), et une note d'une version plus récente,
désormais installée, est nouvelle quelle que soit sa date. Ouverte seule
(depuis l'accueil ou une notification) avec sa version installée, elle avance
ce repère jusqu'à sa version : elle est lue, sans attendre une visite de la
liste. Tests : `announcements.test.ts` (« une note de version vue avant son
installation ») et `announcementsSeenVersion.test.ts`.

## Comment ça marche

| Pièce                      | Où                                                         |
| -------------------------- | ---------------------------------------------------------- |
| Données                    | Firestore, collection `announcements`                      |
| Règles                     | lecture publique des annonces publiées, écriture admin     |
| Index                      | `published` + `publishedAt` (`firestore.indexes.json`)     |
| Envoi des notifications    | `functions/src/announcements.ts` (`onAnnouncementWritten`) |
| Abonnement de l'app        | `src/services/announcementTopics.ts`                       |
| Logique (nouveau, accueil) | `src/services/announcements.ts`, testée                    |

Les notifications passent par des **canaux FCM** (topics), un par langue :
`announcements-fr`, `announcements-en`, `announcements-he`. L'app s'abonne à
celui de sa langue à chaque lancement et à chaque changement de langue ; la
fonction publie un message par canal. Pas de jeton à stocker, pas de compte
requis. La fonction pose `notifiedAt` dans une transaction avant l'envoi :
une annonce ne part qu'une fois, même si le trigger est rejoué.

Tout le monde est abonné par défaut ; l'interrupteur « Informations de
l'équipe » de l'onglet Notifications du profil coupe l'abonnement. Le système
n'affiche rien sans la permission de notifier, qu'on ne demande qu'au geste :
l'interrupteur, ou le bouton « Me prévenir » de la page Informations.

## À savoir

- **Une version de l'app est nécessaire, une fois**, pour que les appareils
  s'abonnent aux canaux. Avant elle, les annonces se lisent dans l'app
  (la page et le bandeau viennent avec le même code), mais aucune notification
  n'arrive.
- **Émulateurs** : FCM n'est pas émulé. Une annonce publiée avec la
  notification cochée dans `npm run dev:local` ferait partir un vrai envoi
  depuis l'émulateur de fonctions : tester avec la case décochée.
- Le site web ne reçoit pas de notifications ; il a la page et le bandeau.
