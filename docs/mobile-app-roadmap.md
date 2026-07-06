# Application mobile — Revue de la PR #73 et feuille de route

> Objectif produit : une app iOS/Android **minimale, centrée sur la lecture**, où l'on
> télécharge sa liste de lectures en local pour lire **hors ligne**, avec des
> **notifications** de rappel. La bibliothèque grandira au fil du temps — l'app ne doit
> pas grossir avec elle.

## 1. Revue de la PR #73 (POC Capacitor)

**Verdict : approche validée, base saine.** Le choix Capacitor est le bon pour cet
objectif : l'app Vue existante est emballée telle quelle, zéro réécriture (vs Flutter).
La PR est propre : configuration minimale, projets natifs générés localement et
git-ignorés, documentation honnête sur ses propres limites (`docs/capacitor-poc.md`,
`docs/capacitor-test-plan.md`).

Points relevés à corriger avant/à la reprise :

| # | Constat | Gravité |
|---|---|---|
| 1 | **Sign in with Apple via `signInWithPopup`** : le bouton n'apparaît que sur iOS natif, or c'est précisément dans la webview que la popup Firebase JS échoue (`capacitor://localhost` n'est pas un authDomain autorisé). Le flux est non fonctionnel en l'état — la bascule vers `@capacitor-firebase/authentication` n'est pas une optimisation, c'est un prérequis. | Bloquant (phase auth) |
| 2 | `signInWithGoogleRedirect` existant : même problème en webview. À remplacer par le flux natif du même plugin. | Bloquant (phase auth) |
| 3 | La PR embarque les ~38 Mo de `public/texts/**` dans le binaire. Simple pour un POC, mais contradictoire avec une bibliothèque « de plus en plus fournie » : l'app grossirait à chaque ajout. → passer au téléchargement à la demande (§4). | Choix d'archi |
| 4 | Conflit avec `main` : uniquement `package-lock.json` → rebase + `npm install` régénère le lockfile. | Trivial |
| 5 | Mineurs hérités du pattern Google : message d'erreur Firebase brut affiché (la clé i18n `appleError` ne sert que de fallback), `migrateGuestReservations` appelé sans `await` ni `.catch()`. | Mineur |

**Versions (juillet 2026)** : la PR épingle Capacitor **8.4.0** ; l'actuel est **8.4.1** —
à jour à un patch près. Prérequis Capacitor 8 : Node ≥ 22 (OK, `engines` du projet),
Xcode 26+, cible iOS 15 minimum, Android target SDK 36, Android Studio Otter+.

## 2. État des lieux du code (ce qui existe / ce qui manque)

Ce qui joue en notre faveur :

- **Point d'interception unique pour l'offline** : toute la lecture passe par
  `textService.loadText()` → `fetch(resolveFilePath(...))` sur `/texts/**`
  (`src/services/textService.ts`). Un seul service à adapter.
- Le **catalogue** (`src/datas/textStudies.json`) est importé dans le bundle JS : la
  liste des textes est disponible hors ligne par construction.
- La **lecture quotidienne** (`userPreferences/{uid}` : `dailyReadingIds`,
  `dailyReadingProgress`) est la brique idéale pour le rappel push et pour définir
  « ma liste de lectures » à télécharger.
- i18n fr/en/he en place, thème sombre, tailles de lecture persistées.

Ce qui n'existe pas encore (tout est à construire) :

- **Aucun** service worker / PWA / cache persistant (les caches actuels sont en mémoire).
- **Aucun** code de notification, ni client (`getMessaging` jamais importé) ni serveur
  (les Cloud Functions actuelles sont 2 fonctions HTTP de SEO, pas de scheduler, pas de FCM).
- Pas de persistance Firestore hors ligne activée côté client.

## 3. Mise à jour technologique (juillet 2026) — briques recommandées

| Besoin | Brique | Notes |
|---|---|---|
| Shell natif | `@capacitor/*` **8.4.1** | Déjà dans la PR (8.4.0) |
| Téléchargement de fichiers | `@capacitor/file-transfer` | `Filesystem.downloadFile` est **déprécié depuis 7.1** — ne pas l'utiliser |
| Stockage local des textes | `@capacitor/filesystem` (`Directory.Data`) | Lire via `convertFileSrc()` + `fetch` (jamais en base64 : risque OOM sur les gros JSON) |
| Index des téléchargements | `@capacitor/preferences` | Petit manifest JSON : ids téléchargés, version, taille |
| Push | `@capacitor-firebase/messaging` **8.2** | Token FCM unifié iOS/Android (gère le mapping APNs→FCM) ; préféré à `@capacitor/push-notifications` seul |
| Auth native Google/Apple | `@capacitor-firebase/authentication` | Corrige les points 1 et 2 de la revue |
| Envoi serveur | `firebase-admin/messaging` + `onSchedule` (Functions v2) | L'infra Functions existe déjà dans le repo |

## 4. Feuille de route proposée

### Phase 0 — Reprendre la PR #73 (½ jour)
1. Rebaser `claude/capacitor-poc` sur `main`, régénérer `package-lock.json`, bump 8.4.1.
2. **Retirer `public/texts/**` du bundle natif** (exclusion au build app) — remplacé par la phase 2.
3. Merger : la coquille Capacitor + scripts + docs sont bons.

### Phase 1 — App minimale « lecture d'abord » (1–2 jours)
- Détection `Capacitor.isNativePlatform()` centralisée (composable `useNativeApp()`).
- En mode app, ne garder que l'essentiel : **Bibliothèque, Lecteur, Tehilim, Lecture
  quotidienne, Profil/login**. Masquer ce qui n'a de sens que sur le web (pages SEO,
  partage social lourd). Le partage de sessions d'étude reste accessible mais en ligne.
- Passer la checklist du plan de test existant : safe-areas, RTL hébreu, dark mode,
  bouton retour Android.

### Phase 2 — Téléchargement hors ligne (cœur du projet, 3–5 jours)
- **`offlineTextService`** qui enveloppe `textService` :
  1. `loadText()` regarde d'abord le stockage local (`Filesystem`, `Directory.Data`) ;
  2. sinon fetch réseau vers le site (les JSON restent hébergés sur Firebase Hosting,
     déjà servis avec `max-age=604800`) ;
  3. l'app ne bundle plus les textes → binaire léger, bibliothèque extensible sans
     mise à jour de l'app.
- **Téléchargement** via `@capacitor/file-transfer` : par livre/traité (un JSON = un
  fichier), avec bouton « Télécharger » dans la Bibliothèque, action « Tout télécharger »
  par corpus, et téléchargement automatique de la **liste de lecture quotidienne**.
- **Écran « Gérer mes téléchargements »** : liste, taille occupée, suppression,
  re-synchronisation (comparaison de version via le manifest).
- **Progression hors ligne** : activer `persistentLocalCache` de Firestore pour que
  « marquer comme lu » fonctionne en avion et se synchronise au retour du réseau.
- Bonus web (optionnel) : `vite-plugin-pwa` + stratégie cache-first sur `/texts/**`
  pour offrir le même offline dans le navigateur.

### Phase 3 — Auth native (1–2 jours + config console)
- `@capacitor-firebase/authentication` : `signInWithGoogle()` et `signInWithApple()`
  natifs sur iOS/Android, popup JS conservée sur le web.
- Config hors code : provider Apple dans Firebase Console, Service ID + clé Sign in
  with Apple côté Apple Developer, capability Xcode (déjà documenté dans
  `docs/capacitor-poc.md`).
- Corriger au passage les mineurs : messages d'erreur i18n, `await` sur
  `migrateGuestReservations`.

### Phase 4 — Notifications Android + iOS (2–3 jours + config APNs)
- **Client** : `@capacitor-firebase/messaging`. Écran d'opt-in (permission runtime
  `POST_NOTIFICATIONS` obligatoire sur Android 13+, prompt système iOS), stockage du
  token FCM dans `userPreferences/{uid}.fcmTokens[]` (+ règle Firestore), rafraîchissement
  du token, suppression au logout.
- **Serveur** (nouvelles Cloud Functions) :
  - `onSchedule` quotidienne : rappel de lecture aux utilisateurs ayant des
    `dailyReadingIds` non complétés (heure configurable dans les préférences) ;
  - (plus tard) notifications d'événements de session : chaîne complétée, deadline proche.
- **Config** : clé APNs uploadée dans Firebase Console, capability Push Notifications
  dans Xcode, `google-services.json` / `GoogleService-Info.plist` dans les projets natifs.

### Phase 5 — Publication (1 jour + délais stores)
- Icônes/splash (`@capacitor/assets`), captures d'écran, politique de confidentialité.
- Apple : Sign in with Apple obligatoire (règle 4.8, couvert en phase 3), suppression de
  compte (déjà implémentée ✅).
- Comptes Google Play (25 $ une fois) et Apple Developer (99 $/an).

## 5. Décisions actées par cette feuille de route

1. **Capacitor, pas Flutter** — le POC valide l'approche, zéro réécriture.
2. **Textes téléchargés à la demande, pas bundlés** — l'app reste légère pendant que la
   bibliothèque grossit ; le hosting Firebase existant sert de CDN.
3. **La « liste de lectures » offline = les téléchargements explicites + la lecture
   quotidienne auto-téléchargée.**
4. **Push portés par la lecture quotidienne** d'abord (la donnée existe déjà), les
   notifications de session viendront ensuite.
