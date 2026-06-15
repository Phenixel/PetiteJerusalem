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

## Limites connues du POC (attendues, pas des bugs)

- **Connexion Google** : `signInWithRedirect/popup` de Firebase ne fonctionne
  pas dans une webview native. Pour le POC, teste avec **email/mot de passe**.
  La V1 réelle nécessitera le plugin `@capacitor-firebase/authentication`
  (auth Google native). C'est le premier vrai chantier identifié.
- **Pas de push** dans ce POC : les notifications (FCM + Cloud Functions
  planifiées) sont une phase ultérieure.
- **Offline / lecture locale** : dépend de la PR qui hébergera les textes en
  local (aujourd'hui ce sont des liens externes).

## Ce qu'on cherche à conclure

Lance-le sur ton téléphone et juge : navigation entre sessions, scroll des
listes, lecture de texte. **Si c'est fluide → Capacitor suffit et on évite une
réécriture Flutter complète. Si ça te paraît mou → on saura que Flutter se
justifie.**
