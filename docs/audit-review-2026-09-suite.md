# Code review (September 2026, continued): cleanliness, duplicates, smoothness, end to end

A second pass after `audit-review-2026-09.md`, with three goals: make the
code cleaner (duplicates, dead code, hard-coded strings), improve
smoothness, and set up a reusable end-to-end test suite, which was used to
hunt for existing bugs. Four parallel reviews (reading chains, library and
reader, shell and preferences, documentation), each finding checked in the
code before being fixed; then the Playwright suite run on the result.

This document says what was done here and what remains, with the file where
to start. The tests are described in `tests.md`.

## 1. End-to-end tests (new)

- `playwright.config.ts`, `e2e/`, `scripts/e2e.mjs`: two projects, `public`
  (pages without Firebase) and `firebase` (accounts, chains, chiourim, daily
  reading, against the Auth and Firestore emulators). `npm run test:e2e`
  reuses emulators already running, otherwise starts empty ones with the
  firebase CLI, otherwise runs the `public` project alone.
- Foundation (`e2e/support/`): consent and introduction already set, failure
  on any JavaScript error of the page, accounts and data set through the
  emulators' REST API (`scripts/lib/firebase-emulator.mjs`, shared with the
  store listing screenshots).
- `e2e` job in `ci.yml`, in parallel with validation.

What the suite found on the base branch, fixed here:

- **Blank page on `/lire/:id`** (old address, bookmarks, shared links): the
  canonical redirect happened when the view mounted, a view the router
  reuses; it now runs in a route guard (`src/router/lireRedirect.ts`).
- **Pages without an `h1`**: home page, sharing home page, chain page and
  daily reading only had an `h2` since the banner's `h1` was removed.

These are the only two findings the suite raised on its own; the rest of
this document comes from the review.

## 2. Bugs fixed

### Reading chains

- Ghost expired bookings: after an expired draw, "read" and cancellation
  landed on the expired one (error, or silent cancellation). Lookups exclude
  expiration and confirmation purges expired bookings from the slot
  (`reservationService.findActiveReservation`, `pruneExpiredForSlots`,
  tested).
- Edit modal: a second watcher filled in the date in UTC (each retry after a
  failure moved the deadline back two hours); the modal closed before
  knowing whether the write had succeeded (input lost). It now waits for the
  result (`save` returns a promise) and stays open on failure.
- A text whose sections were all taken showed up as « Disponible »
  ("Available") again as soon as one section carried two bookings
  (`getTextDisplayStatus` compared the number of bookings with the number of
  sections: a duplicate pushed it above, and no branch caught it). The count
  now covers distinct sections. The case of several people sharing a whole
  text was already handled.
- `ReservationGoneError` was only handled in the reader: the three other
  screens showed a technical error and kept a wrong toggle.
- Selection not purged after reload, auth not listened to on a chain's page
  (sign-up from the modal invisible), slug change without reload,
  `deadline_days` computed at midnight UTC.

### Library and reader

- Catalog search: a typographic apostrophe found nothing (« Sli’hot »,
  « Min’ha »: zero results, whereas the catalog writes « Sli'hot »), and the
  name of a book or a seder did not bring up its tractates (« Zeraim »: zero
  results, twelve now; « Moed »: two, twenty-four now). The three copies of
  the filter did, however, search the Latin name in parentheses:
  « Berakhot » was already found.
- Daily reading left open overnight: the previous day's progress was
  rewritten as today's (`ensureSameDay` before each write and when coming
  back to the screen).
- « gérer » ("manage") mode: searching for a liturgical text gave an empty
  area with no message; the reading menu and progress bar showed in
  « gérer » mode and hid the back-to-top button.
- Reading menu: duplicated anchors (a marker without a line sharing its
  offset with the next block), jump to the wrong passage; anchor by block
  index.
- Daily Tehilim and paracha: civil day without chkia, and not reactive to
  time in two of the three consumers (`useTehilimDay`, `useWeeklyParasha`,
  hooked to the shared clock and `visibilitychange`).
- SEO metadata frozen on language change (library, chnei mikra, reader),
  debounce and highlight timers not cleaned up.

### Shell, preferences, native

- **Android back button**: it navigated under the modals and minimized the
  app from the introduction. Overlay stack (`useOverlayStack`) consulted
  before `router.back()`; `AppModal` component (Teleport, Escape, focus,
  closing on navigation, scroll lock) for the shell's dialogs; session
  modals register in the stack.
- **Analytics**: `capture` was a no-op as long as PostHog was not loaded;
  `home_viewed` and the start of the introduction funnel were lost. Bounded
  queue replayed at initialization; `identify` only after the first auth
  verdict.
- **City pages**: visiting `/horaires/marseille` persisted Marseille as the
  user's location (home page, sidour, widgets) and emitted a "city chosen"
  event on every load. The page's location is no longer persisted.
- **Push token rotation while offline**: reminders went off for good
  (default preferences when reading failed). Strict read, rotation kept
  pending and replayed when the network comes back, a single write.
- Preferences: a write failure locked the value in memory (the server was
  no longer reread on reconnection).
- Apple icon missing from the sign-in button (FontAwesome never loaded),
  auth errors sorted by message rather than by code, unhandled rejection in
  the chiourim backoffice, a `watchEffect` that woke itself up.

## 3. Smoothness

- **A single scroll listener** (`useScrollFrame`, one `requestAnimationFrame`,
  document height read within the frame) for the back-to-top button, the
  reading menu (which forced a reflow on every event), the progress bar and
  the reading position.
- **Office recomputed every minute**: the chain clock, Hebrew day,
  occasions, visible blocks re-rendered the whole text; a scalar day key
  cuts it. Three `setInterval`s replaced by `useNow`.
- **Progress bars as `scaleX`** (`ProgressBar.vue`), wherever an animated
  width triggered layout and paint again (cards, daily reading, audio
  player, uploads).
- Library cards: download state as a computed `Map` (six calls per card,
  150 cards, before). Daily reading: collapsed sections as `v-if` and
  `content-visibility: auto`. Chain management page: available sections and
  chapter rows prepared as `computed`, optimistic "read" toggle instead of a
  Firestore reread.
- `Intl.DateTimeFormat` cached (`intlCache`), `computeZmanim` memoized per
  location and per day, navbar blur reserved for fine pointers, stone wall
  generated after the first render, widgets initialized after
  `router.isReady()` and at idle time, `CollapseTransition` on
  `transitionend` and `prefers-reduced-motion`.

## 4. Duplicates removed

| What was written several times | Where it lives now |
| --- | --- |
| Booking index, chapter cache, slot keys, select all (3 copies) | `composables/useReservationIndex.ts` |
| Saving (4) and ending (2) a chain, with analytics and toasts | `composables/useSessionEditing.ts` |
| Catalog filtering (3, diverging) | `services/catalogSearch.ts`, `useCatalogSearch`, `CatalogSearchField.vue` |
| Theme, fonts, appearance (~150 identical lines) | `composables/createAccountPreference.ts` |
| Bookmarks of the reader and of the daily reading | `composables/useVerseBookmarks.ts` |
| Download state and toggle for a book (2, diverging telemetry) | `composables/useBookDownload.ts` |
| Psalm range (3), paracha title (3) | `composables/useTehilimDay.ts`, `dailyCycles.parashaTitle` |
| Daf-by-daf Talmud rendering (2) | `components/TalmudDafText.vue` |
| Great-circle distance (3), lazy Firestore (2), TTL cache (2), episode sorting (2), Google and Apple sign-in (2 blocks) | `services/geo.ts`, `firebase/lazy.ts`, `services/cached.ts`, `serieService.byEpisode`, `loginView.socialSignIn` |
| Progress statistics of a chain (4 definitions) | `sessionService.getSessionReservationStats` (expired ones excluded, a whole text counts for all its slots) |
| Local end of day (3), text types table (2), guest form validation (2), booking ownership (2, without the local guest identifier) | `dateService.endOfLocalDay`, `TextTypeService`, `reservationService.assertGuestFormValid`, `isOwnReservation` |
| « | Petite Jérusalem » suffix (6) | `seoService.pageTitle` |

`sessionService` lost its dead methods and seven one-line delegations; it
keeps eight, called by the reader (see section 6).

## 5. Hard-coded strings and dead code

- Business errors carry a code (`services/appError.ts`: `SlotTakenError`,
  `GuestNameRequiredError`, `SessionMissingError`, `AuthFlowError`,
  `PreferencesSaveError`...) and `useToast.errorFromException` translates
  them through `errors.*`; no service message is displayed raw anymore, and
  the reader no longer detects a conflict through `includes("déjà
  réservée")`.
- « Chapitre N », « Daf 2a à 7b » labels built in `textService`: structured
  (`heading`) and formatted by the view (`useTextLabels`); the prerender
  keeps French.
- Translated: « Session introuvable » ("Session not found"), loading errors,
  SEO title of the management page, not-found page of the zmanim guide,
  intention not found, the reader's footer links, the footer's
  `aria-label`, the « Utilisateur » ("User") fallback (never written to the
  database anymore), parameterized « libellé : valeur » ("label: value")
  punctuation.
- Removed: `Session.isCompleted` (never true), the bookings' `available`
  field (never read), the `#full` branch, `useNativeApp()`, `resetPlace`,
  `isRtl`, `watchDayKey`, the `serieCreated` emit, two dead methods of
  `sessionService`, seventeen translation keys with no reader (in all three
  languages), the `export` keyword on thirteen classes doubled by a
  singleton and a dozen internal-use symbols. A symmetric test in
  `i18nUsage.test.ts` now refuses any key in `fr.ts` with no reader.

## 6. What remains (by value)

1. **Booking from the reader**: `TextReadingPage.vue` (`reserve`,
   `cancelReservation`, `toggleRead`) remains a copy of `DetailSession`; a
   `useSessionReservation(session, user, form, source)` would bring them
   together, and `sessionService` could then lose its last eight delegations
   (`deleteReservation`, `canUserDeleteReservation`, `createReservationForUser`,
   `createLocalReservation`, `isReservationExpired`, `isTextOrSectionReserved`,
   `markReservationAsCompleted`, `formatBookName`).
2. **Session modals on `AppModal`**: `EditSessionModal`,
   `ReportSessionModal`, `ShareModal`, `GuestIdentityModal`,
   `ReminderSettingsModal` and the two inline modals of
   `SessionManagementPage` register in the back stack but keep their own
   layer (no Escape, no focus trap).
3. **Components of more than a thousand lines**: `TextReadingPage` (still
   ~1,900 lines), `DailyReading`, `SessionManagementPage`, `DetailSession`.
   The composables extracted here are the prerequisite; the next step is to
   move the toolbar and the per-text-type rendering out of the reader.
4. **Reading size** (`useReadingSize`): the only setting that does not
   follow the account (device only), whereas theme and fonts do. To be
   decided.
5. **`Chapitre`/`Daf` in the prerender**: stays in French, by choice; the
   `/en` and `/he` pages of the library do not exist yet.
6. The security and Firestore cost work items from the previous review
   (`audit-review-2026-09.md`, section 2) remain untouched.
