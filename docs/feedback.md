# Nous écrire : les messages et les réponses

Le site et l'app embarquent un formulaire (« Écrivez-nous ») et une page,
« Nous écrire » (`/contact`), où chacun retrouve les messages qu'il a envoyés
et les réponses de l'équipe. Côté équipe, les messages arrivent dans le
backoffice (`/admin/messages`), où l'on les trie et y répond ; la réponse
s'affiche chez la personne, dans l'app ou sur le site, avec une notification
quand son téléphone l'accepte.

Jusqu'en octobre 2026, chaque message devenait une ligne de la base Notion
« Formulaire de support » : on ne pouvait répondre qu'à qui avait laissé un
email. Les messages ne partent plus dans Notion ; ceux d'avant y restent.

## Qui peut écrire, et relire les réponses

- **Dans l'app, avec ou sans compte.** Au premier message, l'app tire une clé
  au hasard (32 octets) et la garde sur le téléphone (stockage de la page et
  préférences natives, en double : perdre la clé, c'est perdre l'accès aux
  réponses). Les messages de l'appareil se relisent avec elle ; le serveur
  n'en garde que l'empreinte SHA-256. Connecté, on relit aussi ceux du compte.
- **Sur le site, avec un compte**, les réponses s'affichent dans le profil.
- **Sur le site sans compte, on écrit aussi**, mais rien ne relie le message
  à la personne : notre réponse ne peut pas s'afficher chez elle. La fenêtre
  le dit en tête, propose de se connecter (en gardant ce qui était déjà
  écrit, un passage de texte signalé par exemple, rouvert sur la page « Nous
  écrire » au retour : `stashFeedbackPrefill`, dans `useFeedback.ts`), et
  rappelle sous la case du contact que sans email ni téléphone, on ne pourra
  pas répondre. Le message arrive quand même dans le backoffice, marqué
  « Ni compte, ni appareil, ni contact » s'il n'a rien laissé. La page « Nous
  écrire » reste réservée aux comptes sur le site.
- **Les versions de l'app d'avant les fils** continuent d'envoyer sans clé :
  leur message arrive dans le backoffice, mais seule une réponse par email
  peut atteindre la personne (si elle a laissé un contact).

## Ce qui part avec un message

Ce que la personne écrit :

- de quoi il s'agit : une nouvelle idée, un bug, une erreur (dans un texte, un
  horaire, une traduction) ou autre chose, avec un champ libre dans ce dernier
  cas ;
- des détails (obligatoire) ;
- un email ou un numéro de téléphone, seulement si elle coche « Me répondre
  aussi par email ou par téléphone ».

Ce que l'app joint d'elle-même, et qu'elle annonce sous le formulaire :

- le support : site web ou application ;
- la plateforme : web, iOS ou Android ;
- la version : celle du binaire installé dans l'app (« 1.4.2 (37) », version
  et build), celle du bundle sur le site ;
- la langue, celle de la notification de réponse ;
- la page d'où le message est parti (`/lire/tehilim`), utile pour un bug ;
- dans l'app, la clé de l'appareil, et son jeton de notification s'il a déjà
  la permission (on ne la demande jamais ici).

Le compte connecté est reconnu par la Cloud Function (son identifiant, son
nom et son email, pour pouvoir lui écrire).

## Où le formulaire s'ouvre

- la page « Nous écrire » (`/contact`), bouton « Nouveau message » ; on y
  arrive par le profil (ligne « Nous écrire » de l'app, raccourci du profil
  du site) ;
- sur le site, le lien « Nous écrire » du pied de page ;
- en bas de l'accueil, site et app, une ligne discrète sous la dédicace ;
- d'un passage de texte (« Signaler une erreur »), déjà amorcé ;
- le bouton « Répondre » d'une information de type question.

Une seule fenêtre (`src/components/FeedbackModal.vue`), montée dans App.vue à
la première ouverture ; `useFeedback.ts` porte l'état partagé qui l'ouvre.

## Un fil, et ses statuts

Chaque message ouvre un fil, document `support/{id}` dans Firestore :

| Champ                                | Contenu                                                                     |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `kind`, `otherKind`                  | la nature (`idea`, `bug`, `error`, `other`) et la précision libre           |
| `messages`                           | `{ from: "user" \| "team", text, at }`, le premier est le message d'origine |
| `status`                             | `new`, `in_progress`, `answered` ou `done` (ci-dessous)                     |
| `note`                               | la note de l'équipe, jamais montrée à la personne                           |
| `contact`                            | l'email ou le téléphone laissé, vide sinon                                  |
| `support`, `platform`, `version`     | ce que l'app a joint                                                        |
| `locale`, `page`                     | la langue et la page d'où le message est parti                              |
| `uid`, `accountEmail`, `accountName` | le compte connecté, `null` sans compte                                      |
| `guestKeyHash`                       | l'empreinte de la clé de l'appareil, `null` sur le site                     |
| `pushTokens`                         | les jetons de notification de l'appareil (cinq au plus)                     |
| `lastFrom`, `unreadByUser`           | qui a écrit en dernier ; une réponse que la personne n'a pas encore lue     |
| `createdAt`, `updatedAt`             | l'arrivée, et le dernier message                                            |

Les statuts reprennent les colonnes de la base Notion :

- **À traiter** (`new`) : un message arrivé, ou une relance de la personne ;
- **En cours** (`in_progress`) : l'équipe s'en occupe ; une relance l'y laisse ;
- **Répondu** (`answered`) : posé par la réponse de l'équipe ;
- **Terminé** (`done`) : posé à la main, par « Répondre et terminer », ou par
  la personne elle-même avec « C'est réglé » (ci-dessous).

Une relance de la personne remet le fil « à traiter » (sauf s'il est en
cours) ; un fil compte 60 messages au plus, au-delà la personne en ouvre un
autre.

**« C'est réglé ».** Tant qu'un fil n'est pas terminé, la personne peut le
clore elle-même, sous la ligne d'état de la messagerie, après une
confirmation. Le fil passe « terminé » et porte `resolvedByUser` (et
`resolvedAt`) : le backoffice l'affiche « Réglé par la personne », la
messagerie lui dit « Vous avez indiqué que c'est réglé ». Rien ne s'ajoute
au fil et aucune notification ne part. Une nouvelle réponse, d'elle
(`replySupportThread`) ou de l'équipe, rouvre le fil et efface la marque.
Callable `resolveSupportThread`, qui vérifie comme les autres que le fil est
bien à l'appelant.

## Les réponses non lues

Dans l'app, une réponse de l'équipe pas encore lue se compte en pastille sur
l'onglet du profil de la barre du bas (`BottomTabBar.vue`). En tête de la
page du profil (app et site), un encart « 1 nouvelle réponse de l'équipe »
montre le début de la réponse et mène droit au fil, ou à la liste quand
plusieurs attendent (`SupportUnreadCard.vue`). Tant qu'il est là, la ligne
« Nous écrire » (groupe Aide de l'app, raccourci du menu du site) quitte sa
place ; une fois la réponse lue, l'encart disparaît et la ligne y revient.

L'état est partagé (`composables/useSupportUnread.ts`) : relu à l'arrivée
d'un compte et à chaque retour dans l'app, seulement si un compte est
connecté ou que l'appareil a déjà écrit (sinon, aucun appel au serveur) ;
ouvrir le fil l'éteint aussitôt partout.

## Le backoffice

`/admin/messages` liste les fils : par défaut ce qui n'est pas terminé (à
traiter d'abord, puis en cours, le plus récent en tête), avec un filtre par
statut, un par nature, et une recherche dans les textes, les contacts et les
versions. Une pastille « Relance » marque un fil où la personne a écrit
après la première fois. L'onglet du menu porte le nombre de messages à
traiter, et le tableau de bord les rappelle dans « À traiter ».

La fiche d'un fil (`/admin/messages/:id`) montre la conversation, la réponse à
écrire, et à côté le statut, la nature (un « Autre » qui était un bug se
reclasse), ce que l'app a joint (la page s'ouvre d'un clic) et la note de
l'équipe. Sous la réponse, une ligne dit où elle arrivera : dans l'app avec
une notification, dans l'app sans notification, par email seulement, ou nulle
part. « Répondre par email » ouvre la messagerie, la réponse en cours déjà
écrite et le message cité, vers le contact laissé ou l'email du compte.

Le même travail se fait en ligne de commande : `support:liste`,
`support:voir`, `support:repondre`, `support:statut` (voir
`docs/backoffice-cli.md`).

## Le chemin d'un message, et d'une réponse

1. `src/services/feedbackService.ts` complète le message (support,
   plateforme, version, langue, page, clé et jeton de l'appareil), puis
   appelle le callable `submitFeedback`.
2. `functions/src/feedback.ts` valide (`functions/src/support.ts`), borne les
   envois par adresse IP (dix par dix minutes) et crée le fil.
3. La page « Nous écrire » relit les fils par `listSupportThreads` (le compte,
   et la clé de l'appareil) et les montre en cartes, sans rien marquer lu.
   Une carte ouvre la page du fil (`/contact/:id`, `SupportThreadPage.vue`),
   une messagerie : l'en-tête (retour, sujet, nature et état, « Détails »),
   le fil, et la barre pour écrire fixée en bas, plein écran dans l'app. Sous
   le dernier message, une ligne dit où il en est (« Bien reçu, nous vous
   répondrons ici », « Nous vous avons répondu »…). « Détails » montre ce que
   la personne a envoyé (nature, date, depuis quoi, page concernée, contact
   laissé ou « aucun ») et comment la réponse lui parvient (notification
   dans l'app, pastille du profil sur le site).
   L'ouvrir marque ce fil-là lu (`markRead` porte son identifiant). Une
   relance passe par `replySupportThread`, qui vérifie que le fil est bien à
   l'appelant.
4. L'équipe répond depuis le backoffice (écriture directe, réservée à l'admin
   par les règles) ou le CLI. La Cloud Function `onSupportThreadWritten`
   voit la réponse ajoutée et envoie une notification aux appareils du fil
   et à ceux du compte (`userPreferences/{uid}.fcmTokens`), dans la langue du
   fil ; la toucher ouvre la page du fil. Un changement de statut ou de note
   n'envoie rien.

Les règles Firestore ferment `support` à tous sauf l'admin : la personne ne
lit ses fils qu'au travers des callables, qui taisent la note de l'équipe,
les empreintes et les jetons. Supprimer son compte efface ses fils
(`forgetSupportThreads`, appelé par `authService.deleteAccount`).

Ce que tiennent les tests (`src/__tests__/support.test.ts`) : l'envoi d'une
version d'avant les fils reste accepté ; un fil ne se relit que par son
compte ou la clé de son appareil, sans la note ; seule une réponse de
l'équipe fait partir une notification ; l'ordre du backoffice met ce qui
attend l'équipe en tête.

## Mise en place

Rien à configurer hors du dépôt : ni clé, ni secret. Il suffit de déployer
les règles et les fonctions :

```bash
firebase deploy --only firestore:rules,functions:submitFeedback,functions:listSupportThreads,functions:replySupportThread,functions:resolveSupportThread,functions:forgetSupportThreads,functions:onSupportThreadWritten --project petite-jerusalem-dev
```

Les notifications de réponse ont les prérequis des rappels de lecture (clé
APNs, voir `docs/app-native.md`). Le secret `NOTION_API_KEY` ne sert plus ;
il peut être supprimé de Cloud Functions une fois le déploiement fait.

## La relance « Tout se passe bien ? »

Le site pose aussi la question de lui-même, à qui a un peu utilisé l'app :
une petite carte en bas de l'accueil, avec deux réponses, « Tout va bien » et
« J'ai quelque chose à dire » (qui ouvre le formulaire).

- « Un peu utilisé » : l'app a été ouverte trois jours distincts. Les jours
  sont notés sur l'appareil au démarrage (`recordUsageDay`, dans App.vue).
- Sur l'accueil seulement, donc jamais pendant une lecture, et seulement quand
  rien d'autre ne réclame l'attention : pas d'introduction, pas de fenêtre
  ouverte, consentement déjà choisi, pas de chiour en cours d'écoute. Elle
  attend quatre secondes après l'arrivée sur l'accueil.
- Elle se tait pour de bon dès qu'on lui répond. Sans réponse, elle revient au
  plus tôt une semaine plus tard, trois fois au maximum.

La règle et sa mémoire sont dans `src/services/feedbackNudge.ts` (testé dans
`src/__tests__/feedbackNudge.test.ts`), la carte dans
`src/components/FeedbackNudge.vue`.
