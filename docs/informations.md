# Les informations de l'équipe

Un moyen de parler aux utilisateurs sans publier de mise à jour : une
nouveauté, les notes d'une version, un incident en cours, une question ou un
sondage. Tout s'écrit depuis le backoffice et s'affiche aussitôt dans l'app
et sur le site.

Chaque nature a sa raison d'être, et donc sa façon de quitter l'accueil :

| Nature      | Pourquoi                                                    | Quitte l'accueil                                                                |
| ----------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Mise à jour | dire à qui vient de mettre à jour ce qui a changé           | une fois lue                                                                    |
| Incident    | prévenir d'un problème avant que la correction n'arrive     | quand il est marqué résolu, ou sur l'appareil qui a la version qui le corrige   |
| Question    | demander l'avis des utilisateurs, avec un sondage au besoin | lue, après une semaine ; un sondage, une fois répondu ou clos (un mois au plus) |
| Nouveauté   | faire découvrir une fonction                                | lue, après une semaine                                                          |

Dans tous les cas, l'information reste dans la liste (`/informations`).

## Publier

1. Se connecter avec le compte admin, ouvrir **Backoffice → Informations**
   (`/admin/informations`), puis **Nouvelle information**.
2. Choisir la nature :
   - **Nouveauté** : une fonction à découvrir ;
   - **Mise à jour** : les notes d'une version, avec son numéro (`3.11.0`) ;
   - **Incident** : un problème connu, qui reste en tête de l'accueil tant
     qu'il n'est pas marqué « résolu ». S'il se règle par une mise à jour,
     indiquer la version qui le corrige (« Corrigé dans la version »,
     `3.11.1`, toujours sous la forme X.Y.Z) : les appareils qui l'ont ne
     le voient plus, ceux qui ne l'ont pas le voient jusqu'à ce qu'ils
     mettent à jour. Tant que l'app n'a pas lu sa propre version, elle
     garde l'incident en cours ;
   - **Question** : l'annonce se termine par un bouton « Répondre », qui ouvre
     le formulaire de support déjà amorcé ; la réponse arrive dans la base
     Notion du support, comme les autres messages. **Ajouter un sondage**
     en fait un choix à cocher (voir « Sondages » plus bas).
3. Écrire le titre et le texte en français. L'anglais et l'hébreu sont
   facultatifs : sans traduction, ces lecteurs voient le français.
4. Un lien, facultatif : une page de l'app (`/bibliotheque/sidour`) ou une
   adresse externe (`https://…`), avec le texte du bouton. Une information
   est lue par toutes les versions installées : le lien vise une adresse que
   les plus anciennes connaissent. `/bibliotheque/sidour` ouvre le Sidour
   partout (les versions récentes la redirigent vers `/sidour`) ; `/sidour`
   seul mène à une page introuvable dans une app pas encore à jour.
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
  - une fois lue, une nouveauté ou une question reste **une semaine en une
    ligne** ; une note de version, elle, quitte l'accueil ;
  - un incident en cours passe avant tout et reste jusqu'à ce qu'il soit
    marqué résolu ; lu, il se réduit à une ligne et laisse la dernière
    nouveauté non lue s'afficher en aperçu dessous. Résolu, il ne revient
    pas sur l'accueil, même jamais lu ;
  - un incident qui porte la version de son correctif ne s'affiche que là
    où cette version manque : une fois la mise à jour faite, il quitte
    l'accueil et n'est plus « Nouveau », lu ou non. Dans la liste, il se lit
    « Résolu », avec « Corrigé dans la version… ». Le site, toujours à la
    dernière version, ne le met jamais en avant ;
  - un sondage ouvert reste en une ligne une fois lu, tant que l'appareil
    n'y a pas répondu (« Sondage : votre avis compte »), un mois au plus.
    Répondu ou clos, il quitte l'accueil.
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

Tests : `announcements.test.ts` (« un incident corrigé par une version »,
« une note de version lue », « un sondage sur l'accueil »).

## Sondages

Une question peut porter un sondage : de deux à huit choix, chacun avec son
libellé (le français obligatoire, l'anglais et l'hébreu facultatifs) et, au
besoin, une image. Un seul choix à cocher, ou plusieurs (« Plusieurs choix
permis »). « Sondage clos » arrête les votes : les choix restent lisibles,
celui de l'appareil marqué.

- **Sans compte.** Chaque appareil vote sous un identifiant tiré au hasard
  et gardé sur l'appareil (`pj_poll_voter`) ; ses réponses s'y retiennent
  aussi (`pj_poll_votes`). Un nouveau vote remplace le précédent. Rien ne
  désigne la personne. Le revers : qui vide son stockage, ou vote depuis
  l'app puis depuis le site, compte deux fois. C'est un sondage d'avis, pas
  un scrutin.
- **Les réponses** se lisent dans le backoffice, sous l'aperçu de
  l'information, ou par `node scripts/admin.mjs info:resultats <id>`. Elles
  ne sont pas montrées aux utilisateurs.
- **Ne pas changer le sens d'un choix** qui a déjà reçu des réponses : les
  votes désignent le choix par son identifiant, ils lui restent attachés.
  Corriger une faute, oui ; remplacer « Bleu » par « Vert », non (retirer le
  choix et en ajouter un autre).
- **Les images** vont dans Storage, sous `announcements/{id}/`, 5 Mo au
  plus. Tout le dossier part avec l'information, images remplacées
  comprises ; d'ici là, une image remplacée reste en ligne. Une image
  envoyée pour une information jamais enregistrée reste aussi.

## Les versions déjà installées

Une information est lue par toutes les versions de l'app qui la
connaissent (depuis la 3.10.9), chacune avec son propre code. Ce qui est
ajouté ici l'est sous des champs que les versions publiées ignorent sans
rien afficher de faux :

| Ajout                   | Version qui le connaît        | Version plus ancienne                                                  |
| ----------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| Note de version lue     | celle qui apporte cette règle | la garde une semaine en une ligne                                      |
| `fixedIn` d'un incident | celle qui apporte cette règle | montre l'incident jusqu'à « résolu »                                   |
| `poll` d'une question   | celle qui apporte cette règle | lit la question, avec « Répondre » et un bouton « Voter » vers le site |

Deux conséquences :

- **Un incident corrigé par une version** fonctionne partout dès que cette
  version est postérieure à celle qui apporte la règle : les appareils plus
  anciens ne l'ont pas, ils doivent voir l'incident, et le voient. Pour un
  correctif déjà publié avant elle (le tahanoun, corrigé en 3.10.11), les
  appareils à jour le verraient encore : le marquer résolu.
- **Un sondage** reçoit, si son lien est vide, un bouton « Voter » vers
  `https://petite-jerusalem.fr/sondage/{id}` (`pollPageUrl`). Cette adresse
  est hors des liens d'application (`BROWSER_ONLY_PATHS`,
  `scripts/lib/app-links.mjs`) : elle s'ouvre dans le navigateur, où le site
  est toujours à la dernière version. Sous `/informations`, elle aurait
  rouvert l'app elle-même, sur une page sans les choix. Les versions qui
  connaissent les sondages ne montrent pas ce bouton (`visibleLink`). Un lien
  choisi à la main est gardé : les anciennes versions ne pourront alors pas
  voter. Tests : `announcements.test.ts` (« le lien de la page de vote »),
  `appLinks.test.ts`.

## Comment ça marche

| Pièce                      | Où                                                         |
| -------------------------- | ---------------------------------------------------------- |
| Données                    | Firestore, collection `announcements`                      |
| Votes                      | `announcements/{id}/votes/{appareil}`                      |
| Images des choix           | Storage, `announcements/{id}/`                             |
| Règles                     | lecture publique des annonces publiées, écriture admin     |
| Index                      | `published` + `publishedAt` (`firestore.indexes.json`)     |
| Envoi des notifications    | `functions/src/announcements.ts` (`onAnnouncementWritten`) |
| Abonnement de l'app        | `src/services/announcementTopics.ts`                       |
| Logique (nouveau, accueil) | `src/services/announcements.ts`, testée                    |
| Vote                       | `AnnouncementPoll.vue`, `useAnnouncements.answerPoll`      |

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

Les règles d'un vote (`firestore.rules`) : le sondage est publié et ouvert,
les choix sont les siens (`poll.optionIds`, posé à l'enregistrement par le
backoffice et la CLI, `pollToStore`), un seul sauf sondage à choix
multiples, et l'heure est celle du serveur. Personne ne relit les votes,
sauf l'admin qui les compte.

Le vote passe par Firestore Lite, dans l'app aussi : le SDK complet garde
une écriture hors ligne en file et ne rend la main qu'à l'accusé du
serveur. Lite échoue tout de suite, et l'écran le dit.

## À savoir

- **Une version de l'app est nécessaire, une fois**, pour que les appareils
  s'abonnent aux canaux. Avant elle, les annonces se lisent dans l'app
  (la page et le bandeau viennent avec le même code), mais aucune notification
  n'arrive.
- **Émulateurs** : FCM n'est pas émulé. Une annonce publiée avec la
  notification cochée dans `npm run dev:local` ferait partir un vrai envoi
  depuis l'émulateur de fonctions : tester avec la case décochée.
- Le site web ne reçoit pas de notifications ; il a la page et le bandeau.
