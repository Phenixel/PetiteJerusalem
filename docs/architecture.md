# Architecture

A map of the repository: what lives where, which way the dependencies go, and
the few rules that keep it that way. It describes the code as it is, written
after the November 2026 review (`audit-review-2026-11.md`); the feature notes
in this folder (`parcours.md`, `chaine-perpetuelle.md`, `app-native.md`...)
go into each area.

## The pieces

| Piece | Where | What it is |
| --- | --- | --- |
| The app | `src/` | One Vue 3 application (Composition API, TypeScript, Tailwind 4), served as the site and wrapped by Capacitor as the iOS and Android apps. |
| The corpus | `public/texts/` | Static JSON: the texts imported from Sefaria, the prayers written here (`tefila/`), translations, page layouts. Fetched on demand, listed with their hashes in `manifest.json`. |
| The backend | `functions/src/` | Cloud Functions: triggers (moderation, perpetual chain, announcements), a scheduled reminder, callables (support, studio), and the social preview served through Hosting rewrites. |
| The rules | `firestore.rules`, `storage.rules` | What a client may read and write. The functions run with the admin SDK and are not subject to them. |
| The tooling | `scripts/` | Build steps (texts manifest, SEO prerender, native bundle pruning), text generators, store publishing, and the command line back office (`admin.mjs`, which writes to production). |
| Native code | `native/` | Widgets, Wear OS and watchOS apps, added to the Capacitor projects generated in CI. |
| Tests | `src/__tests__/`, `e2e/` | Vitest (unit and guard tests) and Playwright (public pages, and Firebase flows and rules on the emulators). See `tests.md`. |

## Inside `src/`

| Folder | Holds | May import |
| --- | --- | --- |
| `views/` | Routed pages, and the sub-components that belong to one page only (about a third of the files). | everything below |
| `components/` | Reusable interface, grouped by area (`parcours/`, `chiourim/`, `holiday/`, `settings/`...). | composables, services, config |
| `composables/` | What touches Vue's reactivity: shared state held in module-level refs, and behaviours tied to a component's life (scroll, audio, overlays). | services, config |
| `services/` | Everything else: domain rules, pure calculations (zmanim, texts, calendar), and access to Firestore, Auth, storage and the device. Recent services are modules of functions (`services/parcours/`), older ones singleton classes. | config, `firebase/`, other services |
| `firebase/` | The only place that creates the SDK clients (`core.ts` for app and auth, `firestore.ts`, `firestoreLite.ts`, `functions.ts`, `storage.ts`) and `lazy.ts`, which loads Firestore on demand. | nothing of the app |
| `config/` | Constants: site, platform (`platform.ts`: native or web), analytics audience, chunk errors. | nothing of the app |
| `content/` | Long editorial content in TypeScript: SEO pages, help center, zmanim guides. Read by the prerender script too. | services, config |
| `datas/` | Generated or hand-kept JSON: the catalog of texts (`textStudies.json`), bundled texts, journey units. | (data) |
| `locales/` | The three languages. French is in the entry chunk (`fr.ts`), the back office's French in `frAdmin.ts` (loaded by `/admin`), English and Hebrew by dynamic import. | (data) |
| `router/` | Routes, all lazy except the home page, redirects and scroll restoration. | views (by `import()`), services |
| `models/`, `repositories/` | Shared types (`models.ts`) and the one repository left (`chiourFirestoreRepository.ts`); most domain types live next to their service. | `firebase/` |

Dependencies go downwards in that table. Two rules are worth stating because
they were broken in places and are easy to break again:

- **A component, a view or a composable never imports `firebase/*`.** The SDK
  comes in through `src/firebase/` and is used by services (and the
  repository) only.
- **A service does not import a composable.** A service that needs to know
  the platform reads `config/platform.ts`. The services that still read
  state held by a composable (widgets, reminders, analytics) are the known
  exceptions.

## State

There is no store library. Shared state is a ref declared at module level in
a composable (`useTheme`, `useZmanimLocation`, `useAudioPlayer`...), imported
wherever it is read. What depends on the account subscribes to
`authService.onAuthChanged` and resets itself when the account changes.
Device settings go through `services/devicePreference.ts`; account settings
through `services/userPreferencesService.ts`, which mirrors them to
Firestore (`userPreferences/{uid}`).

## What loads when

The first load must stay light: the home page is where the site is judged,
and the reader where most visitors land.

- The entry chunk holds the shell (`App.vue`), the home page, the router,
  the French messages and what they import statically. Firestore, the zmanim
  engine (hebcal), PostHog, the audio player and the back office messages
  are loaded on demand. `initialBundle.test.ts` walks the static imports
  from `main.ts`, from the reader and from the sign-in page, and fails when
  one of these modules comes back.
- The home page reads the team's announcements through Firestore Lite
  (`firebase/firestoreLite.ts`, REST, no listen channel). The full SDK, with
  its offline cache, comes with what needs it: an account, the reading
  chains, the lessons, the native app.
- PostHog loads after the first render, and only with consent
  (`services/analyticsService.ts`, the single entry point for tracking).
- The first render waits for the first route and, outside French, for the
  language, one second at most (`main.ts`).

## Data

| Collection | Written by | Notes |
| --- | --- | --- |
| `sessions` | signed-in creators; guests for the `reservations` array | Reading chains. Reservations are an array inside the document, which the rules cannot protect entry by entry (see the open work of the November review). `sessions/{id}/names` holds the prayer names of the perpetual chain. |
| `reports` | anyone (create only) | Session reports; `onSessionReported` counts them and hides a session at three distinct accounts. |
| `userPreferences`, `parcours` | the account itself | Settings, reading positions, push tokens; the journey. |
| `support` | Cloud Functions, and the admin | "Write to us" threads; a person reads theirs through callables. |
| `announcements`, `chiourim`, `series`, `auteurs` | the admin (back office or `admin.mjs`), the studio through callables | Published content. |
| `studioTokens` | the admin | Authors' studio links. |

The admin is one account, recognised by its verified email in both rule
files.

## Shared rules between the app and the functions

`functions/` compiles on its own (CommonJS, `rootDir: src`) and cannot import
`src/`. A rule needed on both sides is therefore either written as a pure
module in `functions/src/` and tested from `src/__tests__/` (`perpetualRound`,
`sessionSlug`, `support`, `reportTally`, `announcementPush`, `ogCardSvg`), or
copied, with a test that compares the two copies (`sunsetReminder`). A copy
without such a test drifts: several are listed in the November review.

## Hosting

`firebase.json` serves `dist/`: prerendered pages for the public routes
(`scripts/prerender-seo.mjs`), the bare shell `app.html` for everything else
(the catch-all rewrite, which leaves `/assets`, `/fonts` and `/texts` alone
so that a missing file answers 404), and two functions behind rewrites
(`socialPreview` for shared links, `ogImage` for their cards). HTML is never
cached by the browser; hashed assets are immutable.
`firebaseHostingConfig.test.ts` holds the shape of this file.
