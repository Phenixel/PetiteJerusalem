# POC Capacitor — App mobile à partir du site Vue existant

But de ce POC : **valider qu'on peut emballer l'app Vue actuelle dans un shell
natif iOS/Android sans réécriture**, et juger la fluidité sur un vrai appareil
avant de s'engager (Capacitor vs réécriture Flutter).

Ce qui est dans cette PR = la **configuration** (deps + `capacitor.config.ts` +
scripts). Les projets natifs (`android/`, `ios/`) sont **générés localement** et
volontairement git-ignorés (code généré, lourd, dépendant de la machine).

## Prérequis

- Node 22 (déjà requis par le projet)
- **Android** : Android Studio + un SDK Android installé
- **iOS** : macOS + Xcode (+ CocoaPods : `sudo gem install cocoapods`)

## Démarrage

```bash
# 1. Installer les deps (Capacitor est déjà dans package.json)
npm install

# 2. Générer les projets natifs (une seule fois)
npx cap add android
npx cap add ios          # macOS uniquement

# 3. Builder le web + synchroniser vers le natif, puis ouvrir l'IDE
npm run cap:android      # ouvre Android Studio
npm run cap:ios          # ouvre Xcode (macOS)
```

Dans Android Studio / Xcode : choisis un émulateur ou ton téléphone branché,
puis **Run**. L'app démarre sur le bundle Vue (le même que le site).

## Itération rapide (sans rebuild à chaque fois)

Plutôt que rebuilder + `cap copy` à chaque changement, pointe l'app sur le
serveur de dev :

1. `npm run dev -- --host` (expose Vite sur le réseau local)
2. Dans `capacitor.config.ts`, décommente / ajoute :
   ```ts
   server: { url: 'http://<ton-ip-locale>:5173', cleartext: true }
   ```
3. `npx cap sync` puis relance depuis l'IDE. Le hot-reload du web fonctionne.

> ⚠️ Retire le bloc `server` avant tout build destiné à un store.

## Scripts ajoutés

| Script | Rôle |
|---|---|
| `npm run app:build` | `build` web + `cap sync` (copie le bundle vers le natif) |
| `npm run cap:sync` | synchronise web + plugins vers les projets natifs |
| `npm run cap:android` | build + ouvre Android Studio |
| `npm run cap:ios` | build + ouvre Xcode |

## Lecture hors-ligne : téléchargement à la demande ✅

> Évolution depuis le POC : les corpus volumineux ne sont **plus embarqués**
> dans le binaire (voir `docs/mobile-app-roadmap.md`, décision n° 2).

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
  cache Firestore persistant activé dans `firebase.ts`.

Vérification : télécharger un livre, activer le mode avion, l'ouvrir.

## Connexion Apple (« Sign in with Apple »)

Apple **impose** « Sign in with Apple » sur l'app iOS dès qu'un autre login tiers
(ici Google) est proposé (règle App Store 4.8). Le bouton est donc câblé mais
**affiché uniquement sur iOS** (`Capacitor.getPlatform() === 'ios'`) — invisible
sur le site web.

Le **code** est en place (`authService.signInWithApple` + bouton). Restent les
étapes **hors-code** (non automatisables ici) pour que ça fonctionne :

1. **Firebase Console** → Authentication → activer le provider **Apple**.
2. **Apple Developer** → créer un *Service ID*, une *Sign in with Apple Key*,
   renseigner le *Return URL* fourni par Firebase.
3. **Xcode** (projet iOS généré) → onglet *Signing & Capabilities* → ajouter la
   capability **Sign in with Apple**.
4. **Production native** : pour un flux 100 % natif (recommandé sur iOS),
   basculer `signInWithApple` sur le plugin
   `@capacitor-firebase/authentication`. La popup JS SDK actuelle suffit pour le
   web et pour valider le POC.

## Autres limites connues du POC (attendues, pas des bugs)

- **Connexion Google** : `signInWithRedirect/popup` de Firebase ne fonctionne
  pas idéalement dans une webview native. Pour le POC, teste avec **email/mot de
  passe**. La V1 réelle nécessitera le plugin `@capacitor-firebase/authentication`
  (auth Google + Apple natives). C'est le premier vrai chantier identifié.
- **Pas de push** dans ce POC : les notifications (FCM + Cloud Functions
  planifiées + clé APNs côté Apple) sont une phase ultérieure.

## Ce qu'on cherche à conclure

Lance-le sur ton téléphone et juge : navigation entre sessions, scroll des
listes, lecture de texte. **Si c'est fluide → Capacitor suffit et on évite une
réécriture Flutter complète. Si ça te paraît mou → on saura que Flutter se
justifie.**
