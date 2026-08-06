# App native (Capacitor) — générer, builder, tester

L'app iOS/Android est le site Vue emballé dans un shell natif
[Capacitor](https://capacitorjs.com/) — décision actée après le POC de
juillet 2026 (fluidité validée sur appareil, zéro réécriture, vs Flutter).
Deux choix d'architecture en découlent :

1. **Les corpus volumineux ne sont pas embarqués** dans le binaire : l'app
   reste légère pendant que la bibliothèque grossit, les textes se
   téléchargent à la demande (voir plus bas).
2. **Les projets natifs (`android/`, `ios/`) sont générés localement et
   git-ignorés** (code généré, lourd, dépendant de la machine). Tout
   ajustement natif doit être scripté dans `scripts/setup-android.mjs` pour
   rester reproductible — la CI régénère `android/` de zéro à chaque release
   (voir `docs/android-ci-cd.md`).

## Prérequis

- Node 22 (déjà requis par le projet)
- **Android** : Android Studio + un SDK Android installé + JDK 21
- **iOS** : macOS + Xcode (+ CocoaPods : `sudo gem install cocoapods`)

## Démarrage

```bash
# 1. Installer les deps (Capacitor est déjà dans package.json)
npm install

# 2. Générer les projets natifs (une seule fois)
npx cap add android
node scripts/setup-android.mjs   # réapplique les ajustements natifs (permissions, signature…)
npx cap add ios                  # macOS uniquement

# 3. Builder le web + synchroniser vers le natif, puis ouvrir l'IDE
npm run cap:android      # ouvre Android Studio
npm run cap:ios          # ouvre Xcode (macOS)
```

Dans Android Studio / Xcode : choisis un émulateur ou ton téléphone branché,
puis **Run**. L'app démarre sur le bundle Vue (le même que le site).

> Après chaque `git pull` : `npm install && npm run app:build` avant de
> rebuilder dans l'IDE — c'est le `cap sync` inclus qui pousse plugins et
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
| `npm run app:build` | build web + retrait des corpus volumineux (`app:prune`) + `cap sync` |
| `npm run cap:sync` | synchronise web + plugins vers les projets natifs |
| `npm run cap:android` | build + ouvre Android Studio |
| `npm run cap:ios` | build + ouvre Xcode |
| `npm run store:screenshots` | régénère les captures de la fiche Play Store (voir `docs/android-ci-cd.md`) |

## Lecture hors-ligne : téléchargement à la demande

- `npm run app:build` retire `dist/texts/{talmud,mishna,tanakh}` (~38 Mo) du
  bundle natif via `scripts/prune-native-bundle.mjs`. Seuls `tehilim.json`
  (~370 Ko) et `talmud-chapters.json` (~40 Ko) restent embarqués.
- Les livres se téléchargent depuis la page **/telechargements** (lien dans la
  navbar de l'app) ou automatiquement pour la liste de lecture quotidienne.
  Stockage : `Directory.Data` en natif (`@capacitor/file-transfer` +
  `@capacitor/filesystem`), Cache Storage sur le web ; index dans
  `@capacitor/preferences` (`src/services/offlineTextStore.ts` et
  `offlineLibraryService.ts`).
- `textService.loadText` passe par `fetchTextResponse` : copie locale d'abord,
  réseau (`https://petite-jerusalem.fr`) sinon.
- La progression (« marquer comme lu ») fonctionne aussi hors ligne :
  cache Firestore persistant activé dans `src/firebase/firestore.ts`.

Vérification : télécharger un livre, activer le mode avion, l'ouvrir.

## Authentification native (Google / Apple)

Les flux OAuth par popup/redirect du SDK JS Firebase ne fonctionnent pas dans
une webview : l'app passe par `@capacitor-firebase/authentication`
(`src/services/authService.ts`) — sélecteur de compte Google natif (avec repli
si le Credential Manager Android est cassé) et feuille « Sign in with Apple »
système sur iOS, puis bridge du credential vers le SDK JS pour que
`onAuthStateChanged` continue de fonctionner comme sur le web.

Apple **impose** « Sign in with Apple » sur l'app iOS dès qu'un autre login
tiers (ici Google) est proposé (règle App Store 4.8). Le bouton est
**affiché uniquement sur iOS** — invisible sur le site web et sur Android.

Étapes **hors-code** à faire une fois pour iOS :

1. **Firebase Console** → Authentication → activer le provider **Apple**.
2. **Apple Developer** → créer un *Service ID*, une *Sign in with Apple Key*,
   renseigner le *Return URL* fourni par Firebase.
3. **Xcode** (projet iOS généré) → onglet *Signing & Capabilities* → ajouter la
   capability **Sign in with Apple**.

## Notifications push

Implémentées côté client (`src/services/pushService.ts`,
`@capacitor-firebase/messaging` : token FCM stocké dans
`userPreferences/{uid}.fcmTokens`, deep-links au toucher) et côté serveur
(Cloud Function planifiée `dailyReadingReminder`). Côté iOS, la clé APNs doit
être uploadée dans la console Firebase et la capability Push Notifications
ajoutée dans Xcode.

Deux rappels, réglés depuis la cloche de la page **Lecture du jour** et
envoyés tant que la lecture du jour n'est pas terminée : à l'heure fixe
choisie, et 20 minutes avant la chkia (`pushSunsetReminderEnabled`). Le second
a besoin d'un lieu, la Cloud Function ne pouvant pas interroger un téléphone
endormi : `pushReminderPlace` reçoit la position arrondie au dixième de degré
(voir `coarsePlace`) et le fuseau, effacés dès que le rappel est coupé. La
chkia est recalculée côté serveur dans `functions/src/sunsetReminder.ts` —
`@hebcal/core`, qui la donne dans l'application, est publié en ESM seul quand
`functions/` compile en CommonJS.

## Géolocalisation (horaires du jour)

La page **Horaires** calcule les zmanim pour la position de l'appareil quand
l'utilisateur la partage (repli sur Paris sinon). Rien ne sort de l'appareil :
le calcul est local, les coordonnées restent en `localStorage`.

- **Android** : `scripts/setup-android.mjs` ajoute `ACCESS_COARSE_LOCATION` et
  `ACCESS_FINE_LOCATION` au manifest. C'est indispensable — le manifest livré
  par `@capacitor/geolocation` est **vide**, donc sans ces lignes
  `requestPermissions()` est refusé d'office et la page reste sur Paris.
- **iOS** (projet généré, non versionné) : ajouter dans `ios/App/App/Info.plist`

  ```xml
  <key>NSLocationWhenInUseUsageDescription</key>
  <string>Votre position sert à calculer les horaires du jour (zmanim) sur votre appareil. Elle n'est envoyée nulle part.</string>
  ```

  Sans cette clé, iOS **ferme l'app** à la première demande de position.

## Widgets d'écran d'accueil

Deux widgets (Horaires, Lecture du jour) accompagnent l'app : l'app pré-calcule
leurs contenus et les pousse au natif via le plugin maison PjWidgets. Côté
Android tout est scripté (`native/android/` + `setup-android.mjs`) ; côté iOS
quelques étapes Xcode manuelles restent nécessaires — voir
`docs/app-widgets.md`.

## Publication

La publication Android est automatisée : chaque tag `vX.Y.Z` déclenche
`deploy-android.yml`, qui régénère `android/`, builde l'AAB signé et l'envoie
au Play Store avec la fiche et les notes de version — tout est documenté dans
`docs/android-ci-cd.md`. iOS (App Store) reste à faire : compte Apple
Developer, `npx cap add ios`, config consoles ci-dessus, TestFlight.
