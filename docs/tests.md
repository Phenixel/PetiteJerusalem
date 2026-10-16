# Tests: unit, guard tests and end to end

Three families complement each other: the Vitest unit tests, which check the
logic and enforce a few repository rules; the Playwright end-to-end suite,
which drives the app in a real browser; and, as a neighbor, the store
listing screenshot script, which prepares its data like the end-to-end
suite.

## Unit tests (Vitest)

```bash
npm run test:unit          # vitest, interactive mode
npx vitest run             # a single pass, what `npm run verify` does
```

The 279 files live in `src/__tests__/*.test.ts`. The configuration
(`vitest.config.ts`) uses the `jsdom` environment by default; tests that do
not need the DOM (those that read the repository or run a script) start
with `// @vitest-environment node`. The `e2e/`, `android/`, `ios/` and
`.claude/` folders are excluded.

### The guard tests

A number of tests do not check a function but a repository rule or a build
invariant. They make `npm run verify` fail (and therefore the CI, on every
PR) for reasons that do not show in the diff. Here they are, with what each
one expects.

The repository's documentation is now written in English, but the two
typography guards keep their scope: the no-long-dash rule
(`typography.test.ts`) still applies everywhere, in every language, code and
documentation included; the French non-breaking-space rule
(`frenchTypography.test.ts`) applies to the French UI locale.

| Test | What it enforces |
| --- | --- |
| `typography.test.ts` | No em dash (U+2014) or en dash (U+2013) in versioned files, code and content included (CLAUDE.md); the only exceptions are the imported corpora under `public/texts/` and the license. |
| `frenchTypography.test.ts` | In `src/locales/fr`, a non-breaking space before `!`, `?`, `;` (narrow, U+202F), before `:` and inside « » quotes (U+00A0), otherwise the sign wraps alone onto the next line on a phone; the `seo` block is out of scope. |
| `searchInputs.test.ts` | Search bars read keystrokes through `liveValue`, not through `v-model` (which waits for the end of the word on a predictive keyboard), and none filters with a `toLowerCase().includes(…)` written in place: every search goes through `services/fuzzySearch`, which finds the other spellings and forgives typos (`docs/design.md`, "A search finds what you meant"). |
| `catalogSearch.test.ts` | Each key of the catalog's alternative names (`src/datas/catalogAliases.ts`) designates a text or a book from `textStudies.json`: a renamed text would make its aliases silent. The same file replays on the real catalog what people type (« chabbat », « kidouchin », « psaume 23 », « genèse »). |
| `cityAliases.test.ts` | Each city among the alternative names (`src/datas/cityAliases.ts`) appears in `cities.json`, and "london", "ירושלים", "st etienne" find their city first. |
| `scopedStyles.test.ts` | In a component's `<style>`, nothing follows a `:global(…)`: Vue's compiler drops what comes after the parenthesis, and `:global([dir="rtl"]) .mur` becomes a rule on every element in Hebrew. The entire selector goes into `:global()`, or the ancestor is written without it (`:root.dark .planche`). |
| `parcoursUnits.test.ts` | `src/datas/parcoursUnits.json` (what each chapter counts in the texts that a Mon parcours program can finish) follows `public/texts/`: `node scripts/parcours-units.mjs` rewrites it, `--check` verifies it. A text corrected without it would shift all the following portions (`docs/parcours.md`). |
| `i18nUsage.test.ts` | Every key passed to `t("…")` or `$t("…")` in `src/` exists in the French locale. |
| `emailAuthErrors.test.ts` | Every key that `describeEmailAuthError` can return (`EMAIL_AUTH_ERROR_KEYS`, the sign-in screen's failure messages) exists in the French locale: they are chosen through a table, which `i18nUsage.test.ts` does not see. |
| `appLinks.test.ts` | The list of paths that the installed app claims (`scripts/lib/app-links.mjs`, served under `/.well-known/`) covers the router's routes and catches no technical path, `/__/auth/` first of all. |
| `widgetParity.test.ts` | Both platforms offer the same widgets: the iOS and Android picker names match, and the Android wiring is complete (provider, `appwidget-provider`, template, labels). |
| `themeColors.test.ts` | Each theme color is readable where it is placed (the ink on the background, on a card and in dark mode; what is written on the tint, at rest and on hover), and nothing in `src` writes white or the ink on the tint (`bg-brand` with `text-white` or `text-primary`, or a CSS rule that sets `var(--color-brand)` as a background with white or the ink): on the light orange of the default theme, neither would be readable (`docs/design.md`, « Les couleurs de thème »). |
| `cardArt.test.ts` | A card that carries its drawn object (`<CardArt`) has no icon in front of its title (`docs/design.md`, "An icon before a title must say something"). |
| `playIcon.test.ts` | The play triangle (`play-solid`) has its center of gravity in the middle of the icon, and no `AppIcon` that carries it adds a margin or an offset: it would look off-center in its circle (`docs/design.md`, "The play triangle is centered on its weight"). |
| `seoTitles.test.ts` | The titles of the `seo` block escape the vertical bar (`{'|'}`), which vue-i18n would otherwise read as a plural separator and truncate. |
| `initialBundle.test.ts` | The graph of static imports from `src/main.ts` contains neither Firestore, nor hebcal, nor PostHog, nor what only shows once under way (the audio player, the auto-scroll, the feature tour) or only for the owner (the back office's French messages, `src/locales/frAdmin.ts`): they load on demand, and a simple import added to a service touched by the root would bring them back into the first load. |
| `firebaseHostingConfig.test.ts` | Every redirect of `firebase.json` has a destination and a status, every header block its headers, and the routes rewritten to `socialPreview` state its cache policy: a header block slipped into `redirects` parses fine and only fails at deploy time. |
| `talmudChapters.test.ts` | `public/texts/talmud-chapters.json` is what `scripts/generate-talmud-chapters.mjs` reads from the texts (`--check`): each chapter starts after the « הדרן עלך » that closes the one before (Berakhot 2 on 13a). The file used to come from a proportional split, several dafim off in every tractate. |
| `prerenderSeo.test.ts` | The prerendering (`seoPages.ts`) injects title, description, canonical, Open Graph, JSON-LD and crawlable body as expected, and the sitemaps are built from the same page lists. |
| `pruneNativeBundle.test.ts` | The native bundle keeps nothing of the SEO prerendering: generated HTML pages, sitemaps, `robots.txt`, `llms.txt`; the app starts on the bare `app.html` shell. Of the corpora, it only keeps the texts listed in `src/datas/bundledTexts.json` (Tehilim, Sidour). |
| `bundledTexts.test.ts` | Each text the app bundles exists in `public/texts/`. The Tehilim are read from the binary, without asking anything of the site; the Sidour also opens there without waiting for the network, then the app downloads in the background the corrected version the site would serve, verified by its hash (a captive portal does not replace it). That the Sidour is bundled in full is enforced by `offlineDailyBooks.test.ts`. |
| `textsManifest.test.ts` | `public/texts/manifest.json` matches the text files (`scripts/texts-manifest.mjs --check`): a text corrected without the manifest following would only be corrected for those who have downloaded nothing. |
| `translations.test.ts` | Each translation (`public/texts/traductions/`) has the shape of the Hebrew file it translates and gives each reader section as many lines as the Hebrew: otherwise it would shift by a verse without any error. Each source has a free license from the list (`docs/traductions.md`), a link and nothing of a Sefaria machine translation; an AI version from the repository (`data/traductions-ia/`) carries the `ai` flag, which makes the reader display the warning. Each corpus keeps the announced coverage. |
| `scopedGlobal.test.ts` | In a `<style scoped>`, no `:global(.a)` followed by another selector: Vue drops everything after the parenthesis and applies the rule to `.a` itself. Written as `:global(.native-app) .volet`, it styled the app's whole page (`<html class="native-app">`) instead of the panel; the entire selector goes inside the parenthesis. |
| `pageForm.test.ts` | The shape of the page: Rachi and Tossafot (`public/texts/talmud-meforshim/`) aligned amoud by amoud and passage by passage with the gemara of each tractate (never more commented passages than passages), a slice of twenty amoudim per file; a paracha mark (petou'ha, setouma) per verse across the 54 parachiot of the Torah, and nowhere else; Az yachir and Haazinou found, with their length, without a word lost. A gemara or a paracha regenerated without its commentaries makes it fail. |
| `environments.test.ts` | Production remains the default environment, and staging has an entirely distinct identity (`scripts/lib/environments.mjs`). Staging stands on its own: no production address hard-coded in the app's code outside the canonical addresses and audience measurement, and the app reads its texts from its environment's site (`APP_SITE_URL`, `src/config/environment.ts`); otherwise the staging app would fetch from production files that are not there yet (docs/staging.md). |
| `commentaryFiles.test.ts` | The Bartenura and the Tossefot Yom Tov (`public/texts/mishna-meforshim/`) of each Michna tractate in the catalog, and Rachi (`public/texts/rashi/`) on the 22 books of the Neviim and Ketouvim, have one slot per displayed line in each chapter; each of the 150 psalms read on its own finds its chapter in Rachi on Tehilim. A text regenerated without its commentaries makes it fail (`node scripts/download-texts.mjs --only=commentaires`). |
| `xcodeWidgets.test.ts` | The iOS widget extension target that `scripts/lib/xcode-widgets.mjs` writes into `project.pbxproj` is valid, starting from the real Capacitor template in `node_modules`; nobody has macOS to open it in Xcode. |
| `xcodeWatch.test.ts` | Same for the Apple Watch app target (`scripts/lib/xcode-watch.mjs`). |
| `lastmod.test.ts` | The sitemap's `lastmod` comes from git (`scripts/lib/lastmod.mjs`): the date of the last commit that touched the page's file, checked on a throwaway repository. |
| `ignoredExceptions.test.ts` | The filter for known Error tracking noise (`src/config/ignoredExceptions`) recognizes the messages actually observed in PostHog, and only those. |
| `analyticsAudience.test.ts` | `resolveUserType` classifies the team, the demo account handed to Google and the closed-test testers apart from real users, whatever the email's case. |
| `adminAccess.test.ts` | `isAdminEmail` only accepts the admin account, and `generateStudioToken` produces a 64-character hexadecimal token that is never repeated. |
| `zmanimDeviceTimezone.test.ts` | A location's times are the same instants whatever the MACHINE's time zone (`process.env.TZ` changed under the computation's feet): it is the test that enforces the fix applied to `@hebcal/core`, described below. |
| `zmanimMatrice.test.ts` | The audit matrix replayed: 59 locations, 30 dates, two opinions, under three device time zones. More than one hundred fifty thousand lines, which must all return the SAME instant whatever the machine's time zone. |
| `zmanimInvariants.test.ts` | The ratios that define each zman over two years and across the catalog's 243 cities, and the fixed points of the solar engine: sunrise and sunset within ten seconds of PyEphem's values, for five cities at the four turning points of the year. |

When a PR is red without any functional test seeming concerned, it is almost
always one of these; the failure message names the file and the rule.

### The fix applied to `@hebcal/core`

`patches/@hebcal+core+6.9.1.patch` fixes three functions in
`dist/esm/zmanim.js`, and `patch-package` replays it on every `npm ci`
through the `postinstall` script. Without it, a fresh install would return
wrong times without anything flagging it.

What it fixes: `zdtToDate` did `res.setMilliseconds(0)`, and both
`sunriseOffset` and `sunsetOffset` did `setSeconds(0, 0)`. `Date` setters do
not truncate the instant, they RECOMPUTE it from the machine's local fields.
At the ambiguous hour of the switch back to standard time, which exists
twice, JavaScript picks the other occurrence; the instant moves back an
hour. A device set to `America/New_York` thus read Paris's sunrise on
November 1, 2026 at 05:37 UTC instead of 06:37, and a Californian device
read the end of Shema at 08:05 instead of 09:05. The displayed location had
nothing to do with it: only the device's time zone mattered.

The fix truncates on the epoch (`Math.floor(ms / 1000) * 1000`), which goes
through no local field. It only touches `dist/esm/zmanim.js`:
`dist/bundle.js` carries the same code, but no import reaches it, since the
package's `exports` field only exposes `.` and `./dist/esm/*`.

The fix is still to be proposed upstream, at `hebcal/hebcal-es6`; the patch
is removed from the repository as soon as a version includes it. See
`docs/audit-horaires-2026-09.md`, item 3.1.

## End-to-end tests (Playwright)

The suite drives the app in Chromium, on the Vite dev server, and checks
what a visitor sees: home, library, reader, times, calendar, languages, then
accounts, reading chains and chiourim against the Firebase emulators.

### Configuration

`playwright.config.ts`:

- `testDir`: `e2e/`, with two projects:
  - `public` (`e2e/public/`): the pages that do not talk to Firebase. No
    prerequisites beyond Node and Chromium.
  - `firebase` (`e2e/firebase/`): accounts, reading chains, bookings,
    perpetual chain (its names, the end of a round, and the Firestore rules
    that guard them, a guest booking that touches nothing but the
    bookings included),
    chiourim. These tests need the Auth and Firestore emulators.
- The Vite server is started by Playwright itself on port **5474**
  (`E2E_PORT`), next to the dev server's 5473 so it can run alongside a dev
  session without taking its server. It runs in DEV mode, so it is wired to
  the emulators like `npm run dev`. The Vue DevTools badge is disabled
  (`STORE_SCREENSHOTS=1`), as it would cover buttons at the bottom of the
  screen.
- Locale `fr-FR`, time zone `Europe/Paris`, "Desktop Chrome" profile.
- Trace and screenshot kept on failure only, in `test-results/`
  (git-ignored, like `playwright-report/`).
- `E2E_CHROMIUM`: path to a Chromium already present on the machine (CI
  image, sandbox), instead of the one `npx playwright install` would
  download (in a Claude cloud session: `/opt/pw-browsers/chromium`).
- In CI: two workers, two retries per test, HTML report in addition to the
  list, and `test.only` forbidden.

### Running the suite

```bash
npx playwright install chromium                   # once: the browser
npm run test:e2e                                  # the whole suite
npm run test:e2e:public                           # without Firebase
npm run test:e2e -- --headed e2e/public/library.spec.ts   # arguments passed to Playwright
```

`npm run test:e2e` goes through `scripts/e2e.mjs`, which takes care of the
emulators before running `playwright test`:

1. if Auth and Firestore emulators are already responding (`npm run
   dev:local` or `npm run emulators` alongside), the suite connects to them
   as they are;
2. otherwise, if the firebase CLI is installed (`npm install -g
   firebase-tools`), it starts empty ones for the duration of the suite
   (`firebase emulators:exec --only auth,firestore`) and stops them on the
   way out; this needs JDK 21 or later, as for dev;
3. otherwise, the suite runs anyway and the tests of the `firebase` project
   report themselves as skipped, with the steps to follow. In CI (`CI`
   set), this third case is not a fallback but an error: a green job must
   mean that the whole suite ran, not that a third of it was skipped.

Everything after `--` is passed to Playwright: `--headed`, `--project
public`, `--debug`, a file path, `-g "un titre"`.

### The foundation: `e2e/support/fixtures.ts`

Every test imports `test`, `expect` and `gotoApp` from this file rather than
from `playwright/test`. It brings two things every test wants without
saying so:

- A "clean" device that has nevertheless already answered the consent
  banner (refusal by default: nothing goes to PostHog) and seen the
  introduction, set in `localStorage` before the page's first script, so
  that neither covers the tested page. The `consent: "ask"` option
  (`test.use({ consent: "ask" })`) brings the banner back, to test it.
- A net for JavaScript errors: any uncaught exception (`pageerror`) and any
  `console.error` during the test make it fail, even if the screen looks
  fine. This is how the suite catches a rejected promise or a Vue error in a
  watcher. A short list of known noise is ignored (the Auth SDK looking for
  the absent emulator, unreachable network resources, `[vite]` messages). A
  message that names an emulator port is only dismissed if it also carries
  the mark of a network failure: in the `firebase` project, where the
  emulators respond, an SDK error logged with its host must make the test
  fail, not disappear.

`gotoApp(page, path)` opens an app page and waits for Vue to have rendered
it (`#app` has a child): the shell is empty until the bundle has arrived.

### Firebase: `e2e/support/firebase.ts`

The tests of the `firebase` project import `test` and `expect` from this
file, which extends the foundation:

- an `emulators` worker fixture, true if the Auth and Firestore emulators
  respond; otherwise each test skips itself (`test.skip`) with the message
  that says how to start them;
- `createAccount(label)`: an account created in the Auth emulator, without
  going through the interface;
- `signIn(page, account, redirect?)`: sign-in through the email form at
  `/login`, waiting to leave it;
- `seedTehilimSession(owner, options)`: a Tehilim chain set in Firestore as
  the app would write it (same fields as `sessionService.createSession`);
- `seedPerpetualChain(fields?)`: a perpetual chain as `chaine:creer` would
  write it, under a unique identifier, with extra fields if needed (a round
  already read); see `docs/chaine-perpetuelle.md`;
- `uniqueId()`: a unique suffix per test and per process;
- `readDoc` and `seedDoc`, re-exported, to read or set any document.

The data is written through the emulators' REST API, without an SDK, via
`scripts/lib/firebase-emulator.mjs`, shared with
`scripts/store-screenshots.mjs`: an account created in the Auth emulator,
documents set in the Firestore emulator with the "owner" token that bypasses
the security rules. The ports are those of `firebase.json` (8470 Firestore,
8471 Auth).

### Writing a new test

- A `*.spec.ts` file in `e2e/public/` or `e2e/firebase/`, depending on
  whether it talks to Firebase or not, that imports the corresponding
  foundation.
- Selectors by role and French label, as the user sees them:
  `getByRole("heading", { level: 1, name: "Bibliothèque" })`,
  `getByRole("button", { name: "Phonétique" })`,
  `getByPlaceholder("Rechercher un tehilim…")`. Never by Tailwind classes,
  which change at the first style tweak; an `href` or a form `id` remains
  acceptable.
- A test creates its own data with `uniqueId()` (accounts, chains) and
  assumes nothing about the emulator's state: the suite tolerates an
  emulator that has already been used, and the tests run in parallel.
- No `waitForTimeout`: wait for a condition (`expect(...).toBeVisible()`,
  `waitForURL`, `toHaveCount`), with an explicit `timeout` if the delay is
  known (deferred filtering, for example).
- A JavaScript error during the test makes it fail: if it is expected and
  unrelated to the app, add the pattern to `IGNORED_CONSOLE` in
  `fixtures.ts`, with the reason why.

### CI

The `e2e` job in `.github/workflows/ci.yml` runs on every PR, in parallel
with `build-and-test`: Node 22, JDK 21, `firebase-tools` (for the
emulators), `npx playwright install --with-deps chromium`, then
`npm run test:e2e`. On failure, `playwright-report/` and `test-results/`
(traces and screenshots) are published as run artifacts, kept for seven
days.

## Store listing screenshots

`scripts/store-screenshots.mjs` (`npm run store:screenshots`) is the
neighbor of the end-to-end suite: it drives the app with Playwright against
ephemeral Firebase emulators populated with fixed demo data (through the
same `scripts/lib/firebase-emulator.mjs`), to produce the Play Store and
App Store listing screenshots reproducibly, the same for both. See
`store-assets/screenshots/README.md`.
