# Petite Jérusalem

Petite Jérusalem est une application web développée avec Vue.js, qui permet de
créer et de rejoindre des chaînes d'étude de textes religieux. L'objectif est
une plateforme qui centralise plusieurs « applications » utiles à la communauté
juive.

## Fonctionnalités

- **Authentification** : connexion sécurisée (via Firebase).
- **Gestion des sessions** : créer, consulter et gérer des sessions d'étude
  (limoud).
- **Réservation de textes** : chacun réserve les parties de texte qu'il
  étudiera.
- **Internationalisation (i18n)** : français, anglais, hébreu.
- **Interface moderne** : responsive et soignée, avec TailwindCSS.

## Pile technique

- **Framework front-end** : [Vue 3](https://vuejs.org/) (Composition API)
- **Langage** : [TypeScript](https://www.typescriptlang.org/)
- **Styles** : [TailwindCSS](https://tailwindcss.com/)
- **Backend / Auth** : [Firebase](https://firebase.google.com/)
- **Outil de build** : [Vite](https://vitejs.dev/)
- **Tests** : [Vitest](https://vitest.dev/) (unitaires) et
  [Playwright](https://playwright.dev/) (bout en bout)

## Installation

### Prérequis

- **Node** : la version 22 est recommandée, c'est celle que fixe le `.nvmrc`
  (`nvm use`). Le minimum accepté par `package.json` est 20.19 (`^20.19.0 ||
  >=22.12.0`), et `scripts/emulators.mjs` refuse de démarrer sous Node 20,
  version minimale du CLI Firebase.
- **Java (JDK 21 ou plus)**, exigé par l'émulateur Firestore (`java -version`).
  Sur macOS, `npm run emulators` choisit de lui-même un JDK 21+ installé si
  `JAVA_HOME` ou le `PATH` pointe sur une version plus ancienne (un
  `openjdk@11` épinglé, par exemple).
- **CLI Firebase** :
  ```bash
  npm install -g firebase-tools
  ```

### Lancer le projet en local

1. **Cloner le dépôt**

   ```bash
   git clone git@github.com:Phenixel/PetiteJerusalem.git
   cd petite-jerusalem
   ```

2. **Installer les dépendances**

   ```bash
   npm install
   ```

3. **Lancer le serveur de développement avec les émulateurs**

   ```bash
   npm run dev:local
   ```

   Cette commande lance en parallèle le serveur Vite et les émulateurs
   Firebase (voir la section suivante). `npm run dev` seul lance uniquement
   Vite : l'app cherche alors des émulateurs qui ne tournent pas, et la
   connexion comme la création de session échouent.

4. **Vérifier le code** (type-check, lint et tests unitaires Vitest)

   ```bash
   npm run verify
   ```

5. **Formater le code** (Prettier, sur `src/` uniquement)

   ```bash
   npm run format
   ```

### Firebase en local (émulateurs)

En développement (`import.meta.env.DEV`), l'app se branche automatiquement sur
quatre émulateurs Firebase : **Auth** (`src/firebase/core.ts`), **Firestore**
(`src/firebase/firestore.ts`), **Storage** (`src/firebase/storage.ts`) et
**Functions** (`src/firebase/functions.ts`). On peut donc s'inscrire, se
connecter et créer des sessions entièrement hors ligne, sans accès au projet
cloud.

Une fois `npm run dev:local` lancé :

- App : http://localhost:5473
- Interface des émulateurs (données Firestore, comptes Auth) :
  http://localhost:8473
- Émulateur Auth : `localhost:8471` ; émulateur Firestore : `localhost:8470`

> Le projet utilise une **plage de ports dédiée** (`5473` pour Vite, `8470` à
> `8477` pour les émulateurs : Firestore 8470 et son websocket 8475, Auth 8471,
> Storage 8472, interface 8473, hub 8474, journalisation 8476, Functions 8477)
> à la place des ports par défaut de Firebase et de Vite, pour tourner à côté
> d'autres projets Firebase sans conflit. Les ports vivent dans `firebase.json`
> (bloc `emulators`) et dans `src/firebase/*.ts` (appels `connect*Emulator`
> côté client) : les deux sont à garder en phase. Au démarrage, le script des
> émulateurs récupère aussi tout émulateur orphelin qui tiendrait encore l'un
> de ces ports, et à l'arrêt il éteint proprement les émulateurs pour n'en
> laisser aucun derrière lui.

**Créer une première session en local**

1. Ouvrir l'app, aller dans **Connexion, puis Inscription**, et créer un
   compte avec n'importe quel couple email / mot de passe (l'émulateur Auth
   accepte tout, aucun vrai email n'est nécessaire).
2. Une fois connecté, créer une session comme d'habitude.

Les données créées dans les émulateurs sont **persistées** dans
`./.emulator-data` à l'arrêt (`Ctrl+C`) et réimportées au démarrage suivant :
les sessions de test survivent aux redémarrages. On peut aussi lancer les
émulateurs seuls avec `npm run emulators`.

## Scripts npm

Tous sont déclarés dans `package.json`.

| Script | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement Vite (port 5473), branché sur les émulateurs. |
| `npm run dev:local` | `emulators` et `dev` en parallèle : la commande de tous les jours. |
| `npm run emulators` | Les émulateurs Firebase seuls, avec persistance dans `./.emulator-data` (`scripts/emulators.mjs`). |
| `npm run build` | Build complet du site : `type-check`, `texts-manifest`, `build-only`, `prerender`, `well-known`. |
| `npm run build-only` | `vite build` seul, sans type-check ni prérendu. |
| `npm run texts-manifest` | Écrit `public/texts/manifest.json`, l'empreinte de chaque fichier de textes (`scripts/texts-manifest.mjs`). |
| `npm run prerender` | Prérendu SEO : une page HTML statique par route, les sitemaps, `app.html` et `llms-full.txt` dans `dist/` (`scripts/prerender-seo.mjs`). |
| `npm run well-known` | Écrit `dist/.well-known/` (App Links Android, Universal Links iOS) (`scripts/well-known.mjs`). |
| `npm run indexnow` | Soumet les URL des sitemaps à IndexNow après un déploiement (`scripts/indexnow.mjs`). |
| `npm run type-check` | `vue-tsc --build`. |
| `npm run lint` | `eslint . --fix`. |
| `npm run format` | `prettier --write src/` : ne formate que `src/`. |
| `npm run verify` | `type-check`, puis `lint`, puis `vitest run` : ce que la CI exécute sur chaque PR. |
| `npm run test:unit` | Tests unitaires Vitest (mode interactif). |
| `npm run test:e2e` | Suite de bout en bout Playwright, avec émulateurs Firebase si possible (`scripts/e2e.mjs`). |
| `npm run test:e2e:public` | La même, limitée au projet `public` (pages sans Firebase). |
| `npm run app:build` | Build du bundle natif : `type-check`, `texts-manifest`, `build-only`, `app:prune`, `app:prune-spm`, `cap:sync`. |
| `npm run app:prune` | Retire du bundle natif ce qui n'a de sens que sur le web (`scripts/prune-native-bundle.mjs`). |
| `npm run app:prune-spm` | Retire du plugin d'authentification iOS les providers OAuth inutilisés (`scripts/prune-spm-providers.mjs`). |
| `npm run cap:sync` | `cap sync` : pousse bundle web et plugins vers `android/` et `ios/`. |
| `npm run cap:android` | `app:build`, puis ouvre Android Studio. |
| `npm run cap:ios` | `app:build`, puis ouvre Xcode (macOS). |
| `npm run store:screenshots` | Captures d'écran des fiches Play Store et App Store (`scripts/store-screenshots.mjs`). |

## Scripts de génération

Les scripts de `scripts/*.mjs` qui n'ont pas de commande npm se lancent avec
`node scripts/<nom>.mjs`. Chacun porte un en-tête qui détaille son rôle.

| Script | Rôle |
| --- | --- |
| `build-brahot.mjs` | Construit les bénédictions et les rites qui les entourent (`public/texts/tefila/*`) à partir du Siddur Edot HaMizrach de l'export public Sefaria. |
| `build-sidour.mjs` | Construit les textes du sidour de semaine (Cha'harit, Min'ha, Arvit) à partir du même Siddur, au format des fichiers de tefila. |
| `download-texts.mjs` | Télécharge tous les textes référencés depuis l'export public Sefaria (GCS) vers `public/texts/`. |
| `generate-cities.mjs` | Régénère `src/datas/cities.json`, la liste de villes du sélecteur de la page Horaires, avec les coordonnées de geonames. |
| `generate-talmud-chapters.mjs` | Génère `public/texts/talmud-chapters.json` en repérant les frontières de chapitres dans le texte brut du Talmud (Sefaria). |
| `generate-torah-weekday.mjs` | Écrit `src/datas/torahWeekday.json`, la lecture de la Torah du lundi et du jeudi matin, paracha par paracha. |
| `texts-manifest.mjs` | Écrit `public/texts/manifest.json` ; `--check` échoue si le manifeste ne correspond plus aux fichiers. |
| `release-notes.mjs` | Notes de version (« Nouveautés ») communes aux deux stores : corps de la release GitHub, sinon la phrase par défaut. |
| `asc-auth-check.mjs` | Sonde d'authentification App Store Connect : signe un JWT avec les secrets ASC et appelle l'API, pour un diagnostic clair en CI. |
| `prune-spm-providers.mjs` | Retire du plugin `@capacitor-firebase/authentication` les providers OAuth que l'app ne propose pas (le SDK Facebook, ~15 Mo sur iOS). |
| `emulators.mjs` | Lance les émulateurs Firebase avec persistance des données dans `./.emulator-data`. |
| `e2e.mjs` | Lance la suite Playwright en réutilisant ou en démarrant les émulateurs Auth et Firestore. |

Les scripts de publication (`setup-android.mjs`, `setup-ios.mjs`,
`play-listing.mjs`, `appstore-listing.mjs`, `asc-submit.mjs`,
`asc-screenshots.mjs`, `ios-signing.mjs`, `prepare-whatsnew.mjs`) sont décrits
dans `docs/android-ci-cd.md` et `docs/ios-ci-cd.md`.

## Tests

Les tests unitaires (Vitest) et la suite de bout en bout (Playwright) sont
décrits dans [docs/tests.md](docs/tests.md), avec la liste des tests
garde-fous qui font échouer la CI pour des raisons qui ne sautent pas aux
yeux (tiret long, espace insécable manquante, clé i18n absente, module lourd
dans le bundle initial…).

## Documentation

| Document | Contenu |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Conventions du dépôt : typographie (jamais de tiret long, espaces insécables) et langue (français). |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Comment signaler un bug, proposer une amélioration, ouvrir une pull request. |
| [SEO.md](SEO.md) | Comment le site est rendu trouvable par les moteurs et les assistants IA : prérendu, sitemaps, IndexNow, rafraîchissement hebdomadaire. |
| [docs/tests.md](docs/tests.md) | Tests unitaires, tests garde-fous, suite de bout en bout Playwright. |
| [docs/app-native.md](docs/app-native.md) | App native Capacitor : générer, builder, tester ; lecture hors ligne, auth native, push, widgets. |
| [docs/app-links.md](docs/app-links.md) | Liens d'application : un lien du site ouvre l'app installée (`/.well-known/`). |
| [docs/app-widgets.md](docs/app-widgets.md) | Widgets d'écran d'accueil (Android / iOS) : Horaires, Lecture du jour et leurs raccourcis. |
| [docs/app-watch.md](docs/app-watch.md) | Montres connectées (Wear OS / Apple Watch) : horaires, lecture du jour, Tehilim. |
| [docs/android-ci-cd.md](docs/android-ci-cd.md) | CI/CD Android : publication Play Store automatique à chaque tag `vX.Y.Z`. |
| [docs/ios-ci-cd.md](docs/ios-ci-cd.md) | CI/CD iOS : envoi automatique sur TestFlight à chaque tag `vX.Y.Z`. |
| [docs/ios-release-plan.md](docs/ios-release-plan.md) | Plan de publication iOS, de « aucun compte Apple » à « app en vente ». |
| [docs/firebase-ci-cd.md](docs/firebase-ci-cd.md) | CI/CD Firebase : ce que déploie `deploy.yml` et les droits du compte de service. |
| [docs/moderation.md](docs/moderation.md) | Modération des sessions (exigences App Store, règle 1.2). |
| [docs/audit-performance-2026-07.md](docs/audit-performance-2026-07.md) | Audit de performance de juillet 2026 : site lent, cache HTML, correctifs. |
| [docs/audit-review-2026-09.md](docs/audit-review-2026-09.md) | Revue de code et d'optimisation de septembre 2026 : corrigé, chantiers, pistes produit. |
| [docs/audit-seo-2026-09.md](docs/audit-seo-2026-09.md) | Audit SEO de septembre 2026 : HTML servi aux robots, fichiers pour robots, actions manuelles. |

## Contribuer

Les contributions sont les bienvenues. Le fichier
[CONTRIBUTING.md](CONTRIBUTING.md) explique comment contribuer au projet.

## Licence

Ce projet est publié sous licence **Creative Commons Attribution, Pas
d'utilisation commerciale 4.0 International (CC BY-NC 4.0)**. Il est
**interdit** d'utiliser ce code à des fins commerciales. Voir le fichier
[LICENSE](LICENSE).
