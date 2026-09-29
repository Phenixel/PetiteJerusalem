# Le bot Telegram des auteurs

Pour un auteur que le studio intimide : il envoie l'audio de son cours à un
bot Telegram, répond à quelques questions, et le cours arrive dans le
backoffice, en brouillon, exactement comme s'il l'avait déposé par son lien
studio. L'équipe le relit et le publie comme les autres (« À traiter »,
`chiour:liste --filtre brouillons`).

Telegram plutôt que WhatsApp : un bot Telegram est gratuit, se crée en deux
minutes et reçoit les fichiers directement ; un bot WhatsApp passe par l'API
WhatsApp Business (numéro dédié, compte validé par Meta).

## Ce que vit l'auteur

1. Il ouvre le lien que l'équipe lui a transmis
   (`https://t.me/<bot>?start=<jeton>`) ; Telegram ouvre la conversation, il
   touche « Démarrer ». Le bot le salue par son nom : il est relié.
2. Il envoie l'audio : un message vocal enregistré dans Telegram, un fichier
   audio (mp3, m4a, wav…), ou un vocal WhatsApp transféré.
3. Le bot demande, une question après l'autre :
   - le **titre** (obligatoire) ;
   - une **description** (bouton « Passer ») ;
   - la **série** : ses séries en boutons, « Nouvelle série » ou « Pas de
     série » (un nom tapé choisit la série de ce nom, ou en crée une) ;
   - le **numéro d'épisode**, si le cours est dans une série : le suivant
     est proposé en bouton ;
   - des **catégories** : les siennes en boutons à cocher, ou tapées,
     séparées par des virgules.
4. Il voit le récapitulatif : « Envoyer », « Corriger » (un seul champ, puis
   retour au récapitulatif) ou « Annuler ».
5. Quelques secondes plus tard : « Le cours est bien arrivé. L'équipe le
   relira, puis il paraîtra dans l'app. »

Plusieurs audios envoyés d'un coup attendent leur tour : le bot les prend
l'un après l'autre. `/annuler` abandonne le cours en cours, `/passer` saute
une question facultative, `/aide` rappelle le fonctionnement. Le niveau n'est
pas demandé : l'équipe le règle à la relecture si besoin.

## Mise en place (une fois)

Dans cet ordre : le secret doit exister **avant** le prochain déploiement des
functions, sinon `firebase deploy --only functions` échoue (la function
`telegramWebhook` le réclame).

1. **Créer le bot.** Dans Telegram, écrire à [@BotFather](https://t.me/BotFather),
   `/newbot`, un nom (« Petite Jérusalem, dépôt des cours ») et un
   identifiant qui finit par `bot`. BotFather donne un **jeton**
   (`123456:ABC…`). Facultatif : `/setuserpic` pour le logo.
2. **Le donner aux functions**, depuis le poste :

   ```bash
   firebase functions:secrets:set TELEGRAM_BOT_TOKEN --project petite-jerusalem-dev
   ```

   (coller le jeton quand il est demandé).
3. **Déployer les functions** : le prochain tag le fait
   (`.github/workflows/deploy.yml`), ou à la main
   `firebase deploy --only functions --project petite-jerusalem-dev`.
   Arrivent `telegramWebhook` et `onTelegramSubmission`.
4. **Relier le bot à sa function**, depuis le poste :

   ```bash
   TELEGRAM_BOT_TOKEN='123456:ABC…' node scripts/admin.mjs telegram:installer
   TELEGRAM_BOT_TOKEN='123456:ABC…' node scripts/admin.mjs telegram:installer --confirmer
   ```

   Le script enregistre le webhook (avec son secret), les commandes et la
   description du bot en français, et garde le nom du bot dans
   `config/telegram` pour fabriquer les liens des auteurs. Le jeton passe par
   l'environnement, jamais en argument (il resterait dans l'historique et la
   liste des processus). À relancer si le jeton change (`/revoke` chez
   BotFather), après avoir mis à jour le secret et redéployé.

## Donner son lien à un auteur

```bash
node scripts/admin.mjs auteur:telegram <auteurId>
```

Le lien Telegram porte le **même secret que le lien studio** : le jeton
studio (64 caractères hexadécimaux) passé à `/start`, qui en accepte
justement 64. Conséquences :

- un auteur sans lien studio actif n'a pas de lien Telegram : `auteur:lien`
  d'abord ;
- `auteur:creer` et `auteur:lien` affichent aussi le lien Telegram une fois
  le bot installé ;
- remplacer le lien studio (`auteur:lien`, ou « Nouveau lien » dans
  l'interface) coupe aussi le bot : au message suivant, le bot le dit à
  l'auteur et oublie la conversation ;
- plusieurs personnes peuvent se relier au même auteur (le rav et la
  personne qui l'aide) : chacune a sa conversation.

## Ce qui arrive dans le backoffice

Un chiour en brouillon (`published: false`), le même document que le studio
(`studioSubmitChiour`), avec `updatedVia: "telegram"` en plus. La série
nouvelle est créée comme par le studio (`<auteurId>--<slug>`).

L'audio est posé sous `chiourim/{slug}/audio.{ext}` :

- mp3, m4a et aac sont gardés tels quels ;
- le reste est converti en **mp3 mono à 64 kb/s** (ce qu'il faut pour une
  voix, léger en 4G). C'est le cas de tous les messages vocaux : Telegram
  les enregistre en Opus dans un conteneur Ogg, que Safari n'a su lire que
  tard. La conversion passe par `ffmpeg-static` dans la function ; si elle
  échouait, un Ogg serait gardé tel quel plutôt que de perdre le cours.

La durée vient de Telegram (vocal, audio) ou d'ffmpeg (document).

## Les limites

- **20 Mo par fichier.** L'API Bot de Telegram ne laisse pas un bot
  télécharger davantage. Un vocal Telegram pèse de 10 à 15 Mo de l'heure :
  il passe. Un mp3 d'une heure (50 à 60 Mo) ne passe pas ; le bot le dit
  tout de suite et propose le vocal, le fichier coupé, ou le lien studio.
  Lever cette limite demanderait un serveur Bot API auto-hébergé, ou un
  client MTProto (GramJS) dans la function : à envisager si la limite gêne.
- Conversations privées seulement : dans un groupe, le bot ne répond pas.
- Une conversion tient dans les neuf minutes de la function
  `onTelegramSubmission` (2 Gio de mémoire) : plusieurs heures d'audio.

## Sécurité

- Le webhook n'accepte que les appels qui portent le secret enregistré par
  `telegram:installer` (en-tête `X-Telegram-Bot-Api-Secret-Token`). Ce
  secret est dérivé du jeton du bot (HMAC) : un seul secret à garder.
- Le jeton studio est revérifié à chaque message et au dépôt.
- `telegramChats`, `telegramSubmissions` et `config` n'ont aucune règle
  Firestore : fermés aux clients, écrits par le SDK admin seulement.
- L'auteur ne peut ni publier, ni toucher aux cours d'un autre : il ne fait
  que déposer des brouillons pour son propre nom.

## Suivi et dépannage

```bash
node scripts/admin.mjs telegram:etat
TELEGRAM_BOT_TOKEN='…' node scripts/admin.mjs telegram:etat   # avec l'état du webhook
```

Conversations reliées (et le cours en cours de chacune), derniers dépôts
avec leur statut (`pending`, `processing`, `done` et son slug, `failed` et
l'erreur), et, avec le jeton, ce que Telegram dit du webhook : messages en
attente, dernière erreur. Le détail est dans les journaux des functions
(`telegramWebhook`, `onTelegramSubmission`).

Un dépôt en échec a prévenu l'auteur (« Renvoyez-moi l'audio pour
réessayer ») ; rien n'est à nettoyer.

## Les données

| Collection                  | Ce qu'elle garde                                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `telegramChats/{chatId}`    | L'auteur relié (jeton studio, `auteurId`), qui écrit (`telegramUser`), la conversation (`state` : cours en cours, file d'attente), la dernière mise à jour lue. |
| `telegramSubmissions/{id}`  | Un cours envoyé : le brouillon, le statut, le slug du chiour créé ou l'erreur.                                                                           |
| `config/telegram`           | Le nom du bot et l'adresse du webhook (`telegram:installer`).                                                                                            |

## Le code, et l'essayer en local

- `functions/src/telegramFlow.ts` : la conversation, pure (sans Firebase),
  et tous les textes du bot ; tenue par `src/__tests__/telegramFlow.test.ts`,
  qui vérifie aussi leur typographie (espaces insécables, pas de tiret long :
  ces textes ne passent pas par `src/locales`, le test du français ne les
  voit pas) et que le script et la function dérivent le même secret de
  webhook (sinon tout appel serait refusé en 401).
- `functions/src/telegram.ts` : le webhook, l'API Bot, le dépôt.
- `scripts/admin.mjs` : `telegram:installer`, `telegram:etat`,
  `auteur:telegram`.

Pour un essai de bout en bout sans Telegram : émulateurs Firestore et
Storage, `TELEGRAM_API_BASE=http://127.0.0.1:<port>` vers un faux serveur
qui répond comme l'API Bot, `FFMPEG_BIN=/usr/bin/ffmpeg`, puis appeler
`telegramWebhook(req, res)` et `onTelegramSubmission.run(event)` depuis
`functions/lib`.
