# Formulaire de support

Le site et l'app embarquent un formulaire de support (« Écrivez-nous ») qui
remplace l'ancien formulaire Notion public. Chaque message devient une ligne
de la base Notion « Formulaire de support », la même qu'avant : rien ne change
côté suivi.

## Ce qui part

Ce que la personne écrit :

- de quoi il s'agit : une nouvelle idée, un bug, une erreur (dans un texte, un
  horaire, une traduction) ou autre chose, avec un champ libre dans ce dernier
  cas ;
- des détails (obligatoire) ;
- un email ou un numéro de téléphone, seulement si elle coche « Vous pouvez me
  recontacter ».

Ce que l'app joint d'elle-même, et qu'elle annonce sous le formulaire :

- le support : site web ou application ;
- la plateforme : web, iOS ou Android ;
- la version : celle du binaire installé dans l'app (« 1.4.2 (37) », version
  et build), celle du bundle sur le site.

## Où il s'ouvre

- sur le site, le lien « Nous écrire » du pied de page ;
- dans l'app, la ligne « Nous écrire » de l'onglet À propos du profil ;
- en bas de l'accueil, site et app, une ligne discrète sous la dédicace.

Une seule fenêtre (`src/components/FeedbackModal.vue`), montée dans App.vue à
la première ouverture ; `useFeedback.ts` porte l'état partagé qui l'ouvre.

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

## Le chemin du message

1. `src/services/feedbackService.ts` complète le message avec le support, la
   plateforme et la version, puis appelle le callable `submitFeedback`.
2. `functions/src/feedback.ts` valide (`feedbackNotion.ts`, testé dans
   `src/__tests__/feedback.test.ts`), borne les envois par adresse IP (cinq
   par dix minutes) et crée la page Notion.

Les colonnes de la base, telles que la fonction les nomme :

| Colonne Notion      | Type         | Rempli avec                            |
| ------------------- | ------------ | -------------------------------------- |
| Donnez des détails  | titre        | les détails                            |
| De quoi s’agit il ? | multi-select | Nouvelle idée, Bug, Erreur ou Autre    |
| Si autre            | texte        | la précision libre du choix « Autre »  |
| Pour vous contacter | email        | le contact, s'il a la forme d'un email |
| Téléphone           | téléphone    | le contact, sinon                      |
| Support             | select       | Web ou Application                     |
| Plateforme          | select       | Web, iOS ou Android                    |
| Version             | texte        | la version installée                   |

Le nom « De quoi s’agit il ? » se termine par une espace dans Notion, hérité du
formulaire d'origine : la fonction le reproduit tel quel. Renommer une colonne
dans Notion casse l'envoi, il faut alors mettre `feedbackNotion.ts` à jour.

## Mise en place

La clé d'intégration Notion n'est jamais dans le dépôt ni dans le bundle : elle
vit dans un secret de Cloud Functions.

1. Dans Notion, ouvrir la base « Formulaire de support », menu « ⋯ »,
   « Connexions », et y ajouter l'intégration dont on a la clé : sans cela,
   l'API répond 404 même avec une clé valide.
2. Poser le secret (une seule fois, puis à chaque rotation de la clé) :

   ```bash
   firebase functions:secrets:set NOTION_API_KEY --project petite-jerusalem-dev
   ```

3. Déployer la fonction :

   ```bash
   firebase deploy --only functions:submitFeedback --project petite-jerusalem-dev
   ```

En local avec l'émulateur, le secret se lit dans `functions/.secret.local` :

```
NOTION_API_KEY=ntn_...
```

Ce fichier est ignoré par git. Sans lui, l'émulateur répond une erreur à
l'envoi, le formulaire affiche « L'envoi a échoué » et rien ne part.
