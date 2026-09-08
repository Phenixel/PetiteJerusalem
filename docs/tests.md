# Tests : unitaires, garde-fous et bout en bout

Trois familles se complètent : les tests unitaires Vitest, qui vérifient la
logique et tiennent quelques règles du dépôt ; la suite de bout en bout
Playwright, qui pilote l'app dans un vrai navigateur ; et, en voisin, le
script de captures d'écran des fiches des stores, qui prépare ses données
comme la suite de bout en bout.

## Tests unitaires (Vitest)

```bash
npm run test:unit          # vitest, mode interactif
npx vitest run             # une seule passe, ce que fait `npm run verify`
```

Les 85 fichiers vivent dans `src/__tests__/*.test.ts`. La configuration
(`vitest.config.ts`) prend l'environnement `jsdom` par défaut ; les tests qui
n'ont pas besoin du DOM (ceux qui lisent le dépôt ou lancent un script)
commencent par `// @vitest-environment node`. Les dossiers `e2e/`, `android/`,
`ios/` et `.claude/` sont exclus.

### Les tests garde-fous

Un certain nombre de tests ne vérifient pas une fonction mais une règle du
dépôt ou un invariant de build. Ils font échouer `npm run verify` (donc la CI,
sur chaque PR) pour des raisons qui ne se voient pas dans le diff. Les voici,
avec ce que chacun attend :

| Test | Ce qu'il tient |
| --- | --- |
| `typography.test.ts` | Aucun tiret long (U+2014) ni demi-cadratin (U+2013) dans les fichiers versionnés, code et contenus compris (CLAUDE.md) ; seules exceptions, les corpus importés sous `public/texts/` et la licence. |
| `frenchTypography.test.ts` | Dans `src/locales/fr`, une espace insécable avant `!`, `?`, `;` (fine, U+202F), avant `:` et dans les guillemets « » (U+00A0), sans quoi le signe part seul à la ligne sur un téléphone ; le bloc `seo` est hors jeu. |
| `i18nUsage.test.ts` | Toute clé passée à `t("…")` ou `$t("…")` dans `src/` existe dans la locale française. |
| `appLinks.test.ts` | La liste des chemins que l'app installée s'approprie (`scripts/lib/app-links.mjs`, servie sous `/.well-known/`) couvre les routes du routeur et n'attrape aucun chemin technique, `/__/auth/` en premier. |
| `widgetParity.test.ts` | Les deux plateformes proposent les mêmes widgets : les noms du sélecteur iOS et Android coïncident, et le câblage Android est complet (provider, `appwidget-provider`, gabarit, libellés). |
| `seoTitles.test.ts` | Les titres du bloc `seo` échappent la barre verticale (`{'|'}`), que vue-i18n lirait sinon comme un séparateur de pluriel et tronquerait. |
| `initialBundle.test.ts` | Le graphe des imports statiques depuis `src/main.ts` ne contient ni Firestore, ni hebcal, ni PostHog : ils se chargent à la demande, et un simple import ajouté dans un service touché par la racine les ramènerait dans le premier chargement. |
| `prerenderSeo.test.ts` | Le prérendu (`seoPages.ts`) injecte titre, description, canonique, Open Graph, JSON-LD et corps explorable comme attendu, et les sitemaps se construisent à partir des mêmes listes de pages. |
| `pruneNativeBundle.test.ts` | Le bundle natif ne garde rien du prérendu SEO : pages HTML générées, sitemaps, `robots.txt`, `llms.txt` ; l'app démarre sur la coquille nue `app.html`. |
| `textsManifest.test.ts` | `public/texts/manifest.json` correspond aux fichiers de textes (`scripts/texts-manifest.mjs --check`) : un texte corrigé sans que le manifeste suive ne serait corrigé que pour qui n'a rien téléchargé. |
| `xcodeWidgets.test.ts` | La cible d'extension des widgets iOS que `scripts/lib/xcode-widgets.mjs` écrit dans le `project.pbxproj` est valide, à partir du vrai template Capacitor de `node_modules` ; personne n'a de macOS pour l'ouvrir dans Xcode. |
| `xcodeWatch.test.ts` | Même chose pour la cible de l'app Apple Watch (`scripts/lib/xcode-watch.mjs`). |
| `lastmod.test.ts` | Le `lastmod` du sitemap vient de git (`scripts/lib/lastmod.mjs`) : la date du dernier commit qui a touché le fichier de la page, vérifiée sur un dépôt jetable. |
| `ignoredExceptions.test.ts` | Le filtre du bruit connu de l'Error tracking (`src/config/ignoredExceptions`) reconnaît les messages réellement observés dans PostHog, et seulement eux. |
| `analyticsAudience.test.ts` | `resolveUserType` classe l'équipe, le compte de démonstration remis à Google et les testeurs du test fermé à part des vrais utilisateurs, quelle que soit la casse de l'email. |
| `adminAccess.test.ts` | `isAdminEmail` n'accepte que le compte admin, et `generateStudioToken` produit un jeton de 64 caractères hexadécimaux jamais répété. |

Quand une PR est rouge sans qu'aucun test fonctionnel ne semble concerné,
c'est presque toujours l'un de ceux-là ; le message d'échec nomme le fichier
et la règle.

## Tests de bout en bout (Playwright)

La suite pilote l'app dans Chromium, sur le serveur de dev Vite, et vérifie ce
que voit un visiteur : accueil, bibliothèque, lecteur, horaires, calendrier,
langues, puis comptes, chaînes de lecture et chiourim contre les émulateurs
Firebase.

### Configuration

`playwright.config.ts` :

- `testDir` : `e2e/`, avec deux projets :
  - `public` (`e2e/public/`) : les pages qui ne parlent pas à Firebase. Aucun
    prérequis au-delà de Node et de Chromium.
  - `firebase` (`e2e/firebase/`) : comptes, chaînes de lecture, réservations,
    chiourim. Ces tests ont besoin des émulateurs Auth et Firestore.
- Le serveur Vite est lancé par Playwright lui-même sur le port **5474**
  (`E2E_PORT`), voisin du 5473 du dev pour tourner à côté d'une session de
  dev sans lui prendre son serveur. Il tourne en mode DEV, donc branché sur
  les émulateurs comme `npm run dev`. Le badge Vue DevTools est désactivé
  (`STORE_SCREENSHOTS=1`), il recouvrirait des boutons en bas d'écran.
- Locale `fr-FR`, fuseau `Europe/Paris`, profil « Desktop Chrome ».
- Trace et capture d'écran conservées à l'échec seulement, dans
  `test-results/` (git-ignoré, comme `playwright-report/`).
- `E2E_CHROMIUM` : chemin d'un Chromium déjà présent sur la machine (image de
  CI, bac à sable), à la place de celui que `npx playwright install`
  téléchargerait.
- En CI : deux workers, deux nouvelles tentatives par test, rapport HTML en
  plus de la liste, et `test.only` interdit.

### Lancer la suite

```bash
npx playwright install chromium                   # une fois : le navigateur
npm run test:e2e                                  # toute la suite
npm run test:e2e:public                           # sans Firebase
npm run test:e2e -- --headed e2e/public/library.spec.ts   # arguments passés à Playwright
```

`npm run test:e2e` passe par `scripts/e2e.mjs`, qui s'occupe des émulateurs
avant de lancer `playwright test` :

1. si des émulateurs Auth et Firestore répondent déjà (`npm run dev:local` ou
   `npm run emulators` à côté), la suite s'y branche telle quelle ;
2. sinon, si le CLI firebase est installé (`npm install -g firebase-tools`),
   il en démarre des vides le temps de la suite
   (`firebase emulators:exec --only auth,firestore`) et les arrête en
   sortant ; il faut un JDK 21 ou plus, comme pour le dev ;
3. sinon, la suite tourne quand même et les tests du projet `firebase` se
   déclarent ignorés, avec la marche à suivre.

Tout ce qui suit `--` est transmis à Playwright : `--headed`, `--project
public`, `--debug`, un chemin de fichier, `-g "un titre"`.

### Le socle : `e2e/support/fixtures.ts`

Tout test importe `test`, `expect` et `gotoApp` de ce fichier plutôt que de
`playwright/test`. Il apporte deux choses que tout test veut sans le dire :

- Un appareil « propre » mais qui a déjà répondu à la bannière de
  consentement (refus par défaut : rien ne part vers PostHog) et vu
  l'introduction, posés en `localStorage` avant le premier script de la page,
  pour que ni l'une ni l'autre ne recouvre la page testée. L'option
  `consent: "ask"` (`test.use({ consent: "ask" })`) remet la bannière, pour la
  tester.
- Un filet sur les erreurs JavaScript : toute exception non rattrapée
  (`pageerror`) et tout `console.error` pendant le test le font échouer, même
  si l'écran a l'air bon. C'est ainsi que la suite attrape une promesse
  rejetée ou une erreur Vue dans un watcher. Une courte liste de bruit connu
  est ignorée (le SDK Auth qui cherche l'émulateur absent, les ressources
  réseau injoignables, les messages `[vite]`).

`gotoApp(page, path)` ouvre une page de l'app et attend que Vue l'ait rendue
(`#app` a un enfant) : le shell est vide tant que le bundle n'est pas arrivé.

### Firebase : `e2e/support/firebase.ts`

Les tests du projet `firebase` importent `test` et `expect` de ce fichier, qui
étend le socle :

- une fixture de worker `emulators`, vraie si les émulateurs Auth et Firestore
  répondent ; sinon chaque test s'ignore de lui-même (`test.skip`) avec le
  message qui dit comment les lancer ;
- `createAccount(label)` : un compte créé dans l'émulateur Auth, sans passer
  par l'interface ;
- `signIn(page, account, redirect?)` : connexion par le formulaire email de
  `/login`, en attendant d'en sortir ;
- `seedTehilimSession(owner, options)` : une chaîne de Tehilim posée dans
  Firestore telle que l'app l'écrirait (mêmes champs que
  `sessionService.createSession`) ;
- `uniqueId()` : un suffixe unique par test et par processus ;
- `readDoc` et `seedDoc`, réexportés, pour lire ou poser un document
  quelconque.

Les données sont écrites par l'API REST des émulateurs, sans SDK, via
`scripts/lib/firebase-emulator.mjs`, partagé avec
`scripts/store-screenshots.mjs` : un compte créé dans l'émulateur Auth, des
documents posés dans l'émulateur Firestore avec le jeton « owner » qui
court-circuite les règles de sécurité. Les ports sont ceux de `firebase.json`
(8470 Firestore, 8471 Auth).

### Écrire un nouveau test

- Un fichier `*.spec.ts` dans `e2e/public/` ou `e2e/firebase/`, selon qu'il
  parle à Firebase ou non, qui importe le socle correspondant.
- Sélecteurs par rôle et libellé français, tels que l'utilisateur les voit :
  `getByRole("heading", { level: 1, name: "Bibliothèque" })`,
  `getByRole("button", { name: "Phonétique" })`,
  `getByPlaceholder("Rechercher un tehilim…")`. Jamais par classes Tailwind,
  qui changent à la première retouche de style ; un `href` ou un `id` de
  formulaire reste acceptable.
- Un test crée ses propres données avec `uniqueId()` (comptes, chaînes) et ne
  suppose rien de l'état de l'émulateur : la suite tolère un émulateur qui a
  déjà servi, et les tests tournent en parallèle.
- Pas de `waitForTimeout` : on attend une condition (`expect(...).toBeVisible()`,
  `waitForURL`, `toHaveCount`), avec un `timeout` explicite si le délai est
  connu (filtrage différé, par exemple).
- Une erreur JavaScript pendant le test le fait échouer : si elle est
  attendue et étrangère à l'app, ajouter le motif à `IGNORED_CONSOLE` dans
  `fixtures.ts`, avec le pourquoi.

### CI

Le job `e2e` de `.github/workflows/ci.yml` tourne sur chaque PR, en parallèle
de `build-and-test` : Node 22, JDK 21, `firebase-tools` (pour les
émulateurs), `npx playwright install --with-deps chromium`, puis
`npm run test:e2e`. À l'échec, `playwright-report/` et `test-results/` (traces
et captures) sont publiés en artefacts du run, conservés sept jours.

## Captures d'écran des fiches

`scripts/store-screenshots.mjs` (`npm run store:screenshots`) est le voisin de
la suite de bout en bout : il pilote l'app avec Playwright contre des
émulateurs Firebase éphémères peuplés de données de démo fixes (par le même
`scripts/lib/firebase-emulator.mjs`), pour produire les captures des fiches
Play Store et App Store de façon reproductible. Voir `docs/android-ci-cd.md`
et `docs/ios-ci-cd.md`.
