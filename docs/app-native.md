# App native (Capacitor) : générer, builder, tester

L'app iOS/Android est le site Vue emballé dans un shell natif
[Capacitor](https://capacitorjs.com/), décision actée après le POC de
juillet 2026 (fluidité validée sur appareil, zéro réécriture, vs Flutter).
Deux choix d'architecture en découlent :

1. **Les corpus volumineux ne sont pas embarqués** dans le binaire : l'app
   reste légère pendant que la bibliothèque grossit, les textes se
   téléchargent à la demande (voir plus bas).
2. **Les projets natifs (`android/`, `ios/`) sont générés localement et
   git-ignorés** (code généré, lourd, dépendant de la machine). Tout
   ajustement natif doit être scripté dans `scripts/setup-android.mjs` ou
   `scripts/setup-ios.mjs` pour rester reproductible, la CI régénère les
   deux de zéro à chaque release (voir `docs/android-ci-cd.md` et
   `docs/ios-ci-cd.md`).

## Prérequis

- Node 22 (déjà requis par le projet)
- **Android** : Android Studio + un SDK Android installé + JDK 21
- **iOS** : macOS + **Xcode 26** (exigé par Capacitor 8 et par l'App Store
  depuis le 28 avril 2026). Le build passe par Swift Package Manager, mais la
  CLI Capacitor exige quand même CocoaPods installé pour `cap add ios`
  (`sudo gem install cocoapods`).

## Démarrage

```bash
# 1. Installer les deps (Capacitor est déjà dans package.json)
npm install

# 2. Générer les projets natifs (une seule fois)
npx cap add android
node scripts/setup-android.mjs   # réapplique les ajustements natifs (permissions, signature…)

npx cap add ios                  # macOS uniquement
IOS_DEVELOPMENT_TEAM=XXXXXXXXXX node scripts/setup-ios.mjs

# 3. Builder le web + synchroniser vers le natif, puis ouvrir l'IDE
npm run cap:android      # ouvre Android Studio
npm run cap:ios          # ouvre Xcode (macOS)
```

Dans Android Studio / Xcode : choisis un émulateur ou ton téléphone branché,
puis **Run**. L'app démarre sur le bundle Vue (le même que le site).

> Après chaque `git pull` : `npm install && npm run app:build` avant de
> rebuilder dans l'IDE, c'est le `cap sync` inclus qui pousse plugins et
> bundle web dans `android/`.

## Itération rapide (sans rebuild à chaque fois)

Plutôt que rebuilder + `cap copy` à chaque changement, pointe l'app sur le
serveur de dev :

1. `npm run dev -- --host` (expose Vite sur le réseau local)
2. Dans `capacitor.config.ts`, décommente / ajoute :
   ```ts
   server: { url: 'http://<ton-ip-locale>:5473', cleartext: true }
   ```
   (le projet utilise le port **5473**, pas le 5173 par défaut de Vite)
3. `npx cap sync` puis relance depuis l'IDE. Le hot-reload du web fonctionne.

> ⚠️ Retire le bloc `server` avant tout build destiné à un store.

## Scripts

| Script | Rôle |
|---|---|
| `npm run app:build` | build web + retrait des corpus volumineux (`app:prune`) + retrait des SDK OAuth inutilisés (`app:prune-spm`) + `cap sync` |
| `npm run cap:sync` | synchronise web + plugins vers les projets natifs |
| `npm run cap:android` | build + ouvre Android Studio |
| `npm run cap:ios` | build + ouvre Xcode |
| `npm run store:screenshots` | régénère les captures de la fiche Play Store (voir `docs/android-ci-cd.md`) ; `-- --ios` produit celles de l'App Store (voir `docs/ios-ci-cd.md`) |

## Lecture hors-ligne : téléchargement à la demande

- `npm run app:build` retire `dist/texts/{talmud,mishna,tanakh}` (~38 Mo) du
  bundle natif via `scripts/prune-native-bundle.mjs`. Seuls `tehilim.json`
  (~370 Ko) et `talmud-chapters.json` (~40 Ko) restent embarqués.
- Les livres se téléchargent depuis la bibliothèque (bouton sur chaque carte,
  « Tout télécharger » par corpus) ou sur proposition de la lecture du jour
  (voir plus bas). Stockage : `Directory.Data` en natif
  (`@capacitor/file-transfer` + `@capacitor/filesystem`), Cache Storage sur le
  web ; index dans `@capacitor/preferences` (`src/services/offlineTextStore.ts`
  et `offlineLibraryService.ts`).
- `textService.loadText` passe par `fetchTextResponse` : copie locale d'abord,
  réseau (`https://petite-jerusalem.fr`) sinon.

Vérification : télécharger un livre, activer le mode avion, l'ouvrir.

## Lecture quotidienne hors-ligne

La page **/bibliotheque/lecture-du-jour** est `offlineOk` dans l'app native :
sans réseau, elle s'ouvre et se lit, à partir de deux copies locales.

- **La liste et son suivi** : `userPreferencesService` garde le dernier
  document `userPreferences` reçu en `localStorage` (clé `pj-preferences:<uid>`)
  et le sert quand l'appareil est hors ligne. Il est effacé à la déconnexion et
  à la suppression du compte.
- **Les textes** : ceux que l'utilisateur a acceptés de télécharger. À l'ajout
  d'un texte (ou à l'activation d'une lecture du moment) dont le livre n'est pas
  sur l'appareil, une modale prévient qu'il ne sera pas lisible hors connexion
  et propose de le télécharger. Un bandeau propose la même chose quand la
  lecture du jour comporte des textes absents, la paracha de la semaine change
  toute seule, par exemple. Rien n'est téléchargé sans cet accord :
  `refreshStaleDownloads` ne fait que remettre au format courant des fichiers
  **déjà** téléchargés.

**Synchronisation.** Deux règles, selon ce qu'on touche :

- **La composition de la liste appartient au serveur.** Hors connexion,
  ajouter un texte, activer une lecture du moment ou régler les rappels affiche
  « pas de connexion » au lieu d'enregistrer. Sans ce garde-fou, le cache
  Firestore persistant (`src/firebase/firestore.ts`) garderait l'écriture en
  attente et l'imposerait au serveur au retour du réseau, en écrasant ce qui a
  pu changer ailleurs, `savePreferences` lève donc `OfflineWriteError` sans
  rien tenter. Au retour du réseau, la page se réaligne sur le serveur.
- **Une lecture faite ne se perd pas.** Le « marquer comme lu » s'enregistre
  hors connexion (`saveDailyProgress` : suivi gardé en `localStorage`, clé
  `pj-daily-progress-pending:<uid>`) et repart au serveur à la première lecture
  réussie des préférences. `mergeDailyProgress` arbitre : **le « lu » gagne**
  même jour, les deux suivis s'additionnent ; jours différents (la coupure a
  passé minuit), le plus récent l'emporte ; le chnei mikra se fusionne à part,
  à la semaine. Conséquence assumée : décocher hors ligne quelque chose que le
  serveur sait déjà lu ne tient pas au retour du réseau.

Vérification : composer une liste, mode avion, rouvrir la lecture du jour (les
textes téléchargés s'affichent, les autres disent qu'ils ne sont pas
téléchargés), cocher une lecture (gardée), tenter d'ajouter un texte (refusé),
revenir en ligne (la liste se resynchronise, la coche remonte).

## Authentification native (Google / Apple)

Les flux OAuth par popup/redirect du SDK JS Firebase ne fonctionnent pas dans
une webview : l'app passe par `@capacitor-firebase/authentication`
(`src/services/authService.ts`), sélecteur de compte Google natif (avec repli
si le Credential Manager Android est cassé) et feuille « Sign in with Apple »
système sur iOS, puis bridge du credential vers le SDK JS pour que
`onAuthStateChanged` continue de fonctionner comme sur le web.

Apple **impose** « Sign in with Apple » sur l'app iOS dès qu'un autre login
tiers (ici Google) est proposé (règle App Store 4.8). Le bouton est
**affiché uniquement sur iOS**, invisible sur le site web et sur Android.

Le Package.swift du plugin embarque par défaut les SDK de **tous** ses
providers, SDK Facebook complet compris, environ 15 Mo de frameworks pour un
bouton qui n'existe pas dans l'app. `scripts/prune-spm-providers.mjs` (rejoué
à chaque `app:build`, npm install restaurant le fichier d'origine) retire
Facebook du build iOS ; sur Android le plugin ne l'embarque que sur opt-in,
que `setup-android.mjs` ne donne pas. Si un provider s'ajoute un jour à
l'app, adapter ce script en même temps que `capacitor.config.ts`.

Étapes **hors-code** à faire une fois pour iOS (détaillées dans
`docs/ios-release-plan.md`) : activer le fournisseur **Apple** dans la console
Firebase, et cocher la capacité **Sign in with Apple** sur l'App ID Apple
Developer. Le *Service ID* et la *Sign in with Apple Key* ne servent qu'au
flux web. Côté projet Xcode, `scripts/setup-ios.mjs` écrit l'entitlement.

## Notifications push

Implémentées côté client (`src/services/pushService.ts`,
`@capacitor-firebase/messaging` : token FCM stocké dans
`userPreferences/{uid}.fcmTokens`, deep-links au toucher) et côté serveur
(Cloud Function planifiée `dailyReadingReminder`). Côté iOS, la clé APNs doit
être uploadée dans la console Firebase et la capability Push Notifications
ajoutée dans Xcode.

Côté iOS, `scripts/setup-ios.mjs` pose l'entitlement `aps-environment` (sandbox
en Debug, production en Release), le background mode `remote-notification` et
les trois hooks APNs dans `AppDelegate.swift` ; la clé APNs doit être importée
dans la console Firebase (voir `docs/ios-release-plan.md`).

Deux rappels, réglés depuis la cloche de la page **Lecture du jour** et
envoyés tant que la lecture du jour n'est pas terminée : à l'heure fixe
choisie, et 20 minutes avant la chkia (`pushSunsetReminderEnabled`). Le second
a besoin d'un lieu, la Cloud Function ne pouvant pas interroger un téléphone
endormi : `pushReminderPlace` reçoit la position arrondie au dixième de degré
(voir `coarsePlace`) et le fuseau, effacés dès que le rappel est coupé. La
chkia est recalculée côté serveur dans `functions/src/sunsetReminder.ts`
`@hebcal/core`, qui la donne dans l'application, est publié en ESM seul quand
`functions/` compile en CommonJS.

## Géolocalisation (horaires du jour)

La page **Horaires** calcule les zmanim pour la position de l'appareil quand
l'utilisateur la partage (repli sur Paris sinon). Rien ne sort de l'appareil :
le calcul est local, les coordonnées restent en `localStorage`.

- **Android** : `scripts/setup-android.mjs` ajoute `ACCESS_COARSE_LOCATION` et
  `ACCESS_FINE_LOCATION` au manifest. C'est indispensable, le manifest livré
  par `@capacitor/geolocation` est **vide**, donc sans ces lignes
  `requestPermissions()` est refusé d'office et la page reste sur Paris.
- **iOS** : `scripts/setup-ios.mjs` ajoute `NSLocationWhenInUseUsageDescription`
  à `ios/App/App/Info.plist`. C'est indispensable, sans cette clé, iOS
  **ferme l'app** à la première demande de position.

## Retour arrière

Chaque plateforme a son geste, et l'app doit câbler les deux.

- **Android** : le bouton (ou le geste) retour du système. Sans le listener
  `backButton` de `src/main.ts`, il **quitte l'app** au lieu de revenir en
  arrière dans la navigation ; sur l'accueil, il la met en arrière-plan, comme
  toute app Android.
- **iOS** : le glissement depuis le bord gauche de l'écran. Il est rendu par la
  WebView, sur son propre historique, celui que le routeur alimente. Deux
  réglages le conditionnent, et il ne se passe rien si l'un des deux manque :
  - `allowsBackForwardNavigationGestures` sur la WKWebView, que
    `scripts/setup-ios.mjs` pose dans l'`AppDelegate` (WKWebView le désactive
    par défaut, et Capacitor n'expose pas d'option de configuration) ;
  - `overscroll-behavior` laissé libre sur l'axe horizontal
    (`src/assets/main.css`). La règle qui neutralise l'étirement vertical
    d'Android vaut pour les deux axes si on ne la suffixe pas, et WebKit lit
    l'horizontale comme l'ordre de couper la navigation par glissement.

Un test tient les trois points (`src/__tests__/nativeBackNavigation.test.ts`).

## Widgets d'écran d'accueil

Deux widgets (Horaires, Lecture du jour) accompagnent l'app : l'app pré-calcule
leurs contenus et les pousse au natif via le plugin maison PjWidgets. Les deux
plateformes sont scriptées, `native/android/` + `setup-android.mjs` d'un côté,
`native/ios/` + `setup-ios.mjs` de l'autre, qui écrit jusqu'à la cible
d'extension dans le projet Xcode. Seul l'App Group demande trois clics dans le
portail Apple, une fois pour toutes, voir `docs/app-widgets.md`.

## Liens du site qui ouvrent l'app

Un lien vers `petite-jerusalem.fr` (une session partagée reçue par message,
par exemple) ouvre l'app quand elle est installée, et le navigateur sinon.
Le domaine et l'app se reconnaissent par un fichier servi par le site
(`/.well-known/`), les chemins concernés tiennent en une liste unique
(`scripts/lib/app-links.mjs`) que les deux plateformes et un test partagent.
Voir `docs/app-links.md`, notamment les deux valeurs de signature à fournir.

## Bandeau « mise à jour disponible »

Une app installée peut rester des mois en arrière (mises à jour automatiques
désactivées) : les correctifs ne l'atteignent jamais. Au lancement, puis à
chaque retour au premier plan, au plus une fois toutes les 6 h
`src/services/appUpdateService.ts` demande au store de la plateforme si une
mise à jour est disponible, et affiche un bandeau refusable en tête de l'app,
avec un lien vers la fiche du store (`components/AppUpdateBanner.vue`). Un
refus vaut jusqu'à la version suivante.

La source, sur les deux plateformes, est le store lui-même, jamais le tag de
release : une release peut attendre des jours la revue d'Apple ou de Google,
et annoncer la mise à jour pendant cette fenêtre enverrait vers une fiche qui
ne la propose pas encore.

- **Android** : l'API In-App Updates du Play Store
  (`@capawesome/capacitor-app-update`), la réponse du store pour l'appareil
  lui-même : revue Google passée, propagation faite, rollout progressif
  compris.
- **iOS** : `itunes.apple.com/lookup?bundleId=…`, l'API publique de l'App
  Store, qui fait autorité. Tant que l'app n'y est pas publiée, le lookup ne
  renvoie aucun résultat et le bandeau n'apparaît jamais sur iOS.

`app-version.json`, l'ancienne source Android (plugin `appVersionManifest`
dans `vite.config.ts`), annonçait la version dès la mise en ligne du site,
donc pendant toute la revue Google : le bandeau redirigeait vers une fiche
Play qui ne proposait pas encore la mise à jour. Le site continue de publier
le fichier pour les versions déjà installées qui le consultent encore.

Tout échec (hors ligne, store injoignable, build qui ne vient pas du store)
laisse simplement le bandeau masqué, jamais de faux positif.

## Publication

Un tag `vX.Y.Z` publie tout d'un coup :

| Workflow | Cible | Résultat |
|---|---|---|
| `deploy.yml` | site | mise en ligne de `petite-jerusalem.fr` |
| `deploy-android.yml` | Play Store | AAB signé + fiche + notes de version, publiés (`docs/android-ci-cd.md`) |
| `deploy-ios.yml` | App Store | IPA signé envoyé sur **TestFlight** + fiche (`docs/ios-ci-cd.md`) |

Côté iOS, le tag envoie le binaire, soumet la version à l'examen et la met en
vente dès l'accord d'Apple, sans clic dans App Store Connect. Le seul délai qui
reste est celui de l'examen, quelques heures à quelques jours. Le chemin
complet, compte Apple Developer, consoles, premier build, soumission, est
décrit dans `docs/ios-release-plan.md`.
