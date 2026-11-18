# Code and optimization review (September 2026)

A complete pass over the repository: vulnerabilities, bugs, dead code,
performance of the site and the app, and ideas for improvement. Six parallel
readings (services, components and composables, views, backend and rules,
build and content, native app and offline), each finding checked in the code
before being kept. This document separates what the PR fixes from what it
leaves as open work, giving for each open item the file where to start.

It complements the July performance audit (`audit-performance-2026-07.md`),
whose gains it also checks: one of them had regressed (section 1).

The open items of section 2 are tracked in the « Tâches » ("Tasks") database
of the project's Notion (one tagged task per item); this section keeps their
summary and the entry point in the code.

## 1. Fixed in this PR

### Weight of the site and the app

- **Firestore had come back into the initial load.** Since `src/firebase/`
  was split, `moderationService` imported `firebase/firestore` statically
  for reporting, and `authService` (hence App.vue) imports it for the terms
  filter: the entire Firestore SDK (671 kB, 173 kB gzip) was once again
  preloaded by `index.html` on every page, web and app. Reporting now loads
  Firestore on demand. Preloaded JS: 335 kB gzip before, 162 kB gzip after.
- **A test holds the boundary** (`src/__tests__/initialBundle.test.ts`): it
  follows the static imports from `main.ts` and refuses Firestore, Storage,
  Functions, hebcal and PostHog in that graph. It failed on the base branch,
  it passes now; an import added by mistake will make it fail with the exact
  path.
- **App.vue**: the bottom bar, the update banner (and its Capacitor service)
  and the offline notice become async components; the site no longer ships a
  single line of what only concerns the app.
- **main.ts**: syncing downloaded texts only starts in the app; on the site
  it pulled in the service, the catalog and the Capacitor shims (seven
  requests, ~18 kB gzip) to read an empty key.
- **index.html**: the Google family "Noto Serif Hebrew" leaves the blocking
  URL (the subset shipped in `/fonts` comes before it in every stack, so it
  was no longer used); that subset is preloaded.
- Three icons never referenced removed from the shipped registry.
- `@tailwindcss/vite` becomes a dev dependency; `app:build` no longer
  prerenders the site's 1,465 pages only to delete them right away.

### Smoothness (especially on small phones)

- **Reading pinch** (`useReadingPinch`): the non-passive `touchmove`
  listener is only attached during a two-finger gesture. Attached
  permanently on `document`, it forced the browser to wait for the script
  before every one-finger scroll, during the whole reading: the text
  "stuttered".
- **Reading progress bar**: `transform: scaleX` instead of a width animated
  on every scroll frame (layout and paint triggered again on each one).
- **Links**: `a { transition: all }` also transitioned the layout properties
  of every link on the site; restricted to colors, opacity, transform and
  shadow.
- **Stone wall**: unchanged. The halos remain animated everywhere; they are
  only frozen on devices already detected as weak (`useDevicePerf`,
  persisted verdict), an existing mechanism. If mobile Web Vitals justify it
  one day, `stone-wall--static` on `pointer: coarse` is the lead (see the
  Notion task « Fluidité », "Smoothness").
- **PostHog session replay in the app: measured rather than turned off.**
  Each native device draws its cohort once (replay active or not, kept on
  the device) and all its events carry `replay_cohort`: Web Vitals (INP
  above all) can be compared between the two halves in PostHog. The web is
  not affected (`web`). To be decided after a few weeks: replay everywhere
  or nowhere, and the draw goes away.
- **Chain management page**: signing up a guest no longer replaces the
  whole page with a spinner (list unmounted, scroll position lost).
- **Audio player**: the duration probe no longer restarts when the track is
  already in the global player, and it releases its download (`load()`) on
  navigation.
- **Chain management page**: booking index as a `computed` (the template
  functions went through the bookings ten times per row, quadratic on a
  Talmud chain), chapters cached.
- **Daily reading, « gérer » ("manage") mode**: catalog filtering waits
  150 ms after the last keystroke (like the library), selection as a `Set`.
- **Home page**: a single shared clock (`useNow`) for the times, 'Omer,
  moon and sidour cards, instead of four `setInterval`s.
- **Widgets**: the payloads (hebcal, catalog) are imported on demand at the
  first computation, no longer when the app loads.
- **Sharing QR code**: npm module via `import()` (hashed, immutable, typed
  chunk) instead of a vendored 57 kB script served with no cache or hash.

### Bugs

- **Deadline shifted on every save**: the edit modal displayed the UTC time
  in a `datetime-local` field, reinterpreted as local time on save; each
  « Enregistrer » ("Save") without touching the date moved it back two hours
  in France. Local formatting (`toDateTimeLocal`).
- **Deadline of a new chain**: `new Date("YYYY-MM-DD")` reads midnight UTC,
  the evening before west of Greenwich. The chain now runs until the local
  end of the chosen day (`endOfLocalDay`), and the "chain finished" rule
  lives only once in `sessionService.isSessionFinished` (three copies
  before).
- **Ghost text in the reader**: two texts opened in quick succession sent
  two requests, and the first to come back wrote the old text under the new
  address. Request token in `loadContent`.
- **Reader in chain mode**: a chain not found or offline made the mount
  reject silently; the text remains readable, the error is logged.
- **Moderation filter bypassed by a "!"**: the leet table converts "!" into
  "i" across the whole text, so "pute!" became "putei" and got through. The
  substitution now only applies next to a letter; test added.
- **Account deletion**: preferences, progress and bookmarks were purged
  BEFORE `deleteUser`, which Firebase refuses without a recent sign-in; an
  email account could end up emptied but still there. Sign-in freshness is
  checked before the purge.
- **Email sign-up**: the username was not propagated to subscribers (the
  navbar kept the email); a `setTimeout(100)` stood in for it.
- **Corrected texts invisible for a week on the web**: `/texts/**` is served
  with seven days of cache and the URL did not carry the manifest's
  fingerprint (never loaded on the web). The manifest (12 kB, no-cache) is
  loaded once per session before the first text.
- **Talmud chapters**: a network failure on `talmud-chapters.json` was
  remembered for the whole session (daf-by-daf splitting until reload).
- **Series cache** never invalidated by the backoffice (creation, deletion,
  author renaming).
- **Reporting impossible** for a chain whose title is longer than 300
  characters (cap in the rules): name truncated.
- **Chiourim pages**: the background refresh put back the previous chiour
  if one had switched episodes in the meantime; `v-for` key on the name
  (possible duplicates) replaced by the slug; unhandled rejection in the
  studio.
- **Social tags**: the previous page's `og:image` stayed on the next one.
- **Chain progress bar**: `fill-mode-backwards` class nonexistent in
  Tailwind 4, hence a flash on every display.
- **Accessibility**: hard-coded French `aria-label` on the back-to-top
  button (all languages); two `h1`s per page (the site banner carried one).

### Backend and rules

- **Forgeable automatic hiding**: three anonymous reports from the same
  device (guest identifier freely chosen, or absent, in which case the
  function counted the document itself) hid any chain. Only accounts now
  count toward the threshold; guest reports remain counted and visible in
  the backoffice. The rules require a non-empty guest identifier for a
  report without an account.
- **`setTitle` of the social preview**: string replacement, so `$'`, `$&`
  or `$1` in a chain name were interpreted (a "$'" title copied all the
  following HTML into the tag). Replacement function.
- **Daily reminder**: day and hour computed in the time zone of the user's
  location (Paris before: past midnight in Paris, the progress of a reader
  in Israel was deemed stale and the reminder went out wrongly);
  `hourCycle: "h23"` (some ICU versions give "24" at midnight); delay raised
  to five minutes; a failing profile no longer blocks the following ones.
- **Social preview**: five-second timeout on the shell `fetch` (a human
  visitor otherwise waited for the function's timeout); the resvg binary
  and its 1.3 MB of fonts no longer load at the cold start of the callables,
  the trigger and the scheduler.
- **OG card**: the last line of the title only got one word before the
  ellipsis (`maxLines - 1`).
- **CI**: the Cloud Functions are compiled on every PR (before, the first
  compilation happened at deployment, after the site went live).
- `firebase.json`: `trailingSlash: false` (`/horaires/` answered 200 with
  the shell and no canonical); prerendered JSON-LD with `<` escaped.
- **Session rules**: title, description, slug, creator name and bookings
  array typed and bounded on creation and on update by the owner (nothing
  bounded them, up to the document's megabyte); `personId` frozen (no more
  transfer of a session by its owner).
- **Guest booking migration**: candidate sessions taken from the shared
  cache instead of a full read of the collection on every sign-in (three
  times per sign-in page).
- **Social preview**: `/chiourim/serie/:id` resolved by a single document,
  instead of falling back on the catalog scan.

### Native app

- **FCM token rotation**: the new token replaces the old one in the profile
  as soon as the plugin reports it; before, reminders went silent until
  re-enabled by hand.
- **Offline settings**: the profile page (settings without an account in
  the app) displayed « connexion impossible » ("cannot connect") when
  changing a local theme.
- **iOS**: `getToken()` right after the permission can fail as long as the
  APNs token has not arrived; we wait for the plugin's event before
  concluding it was refused.
- **Offline notice**: « réessayer » ("retry") replays the navigation
  instead of restarting the whole app.
- **Native bundle**: sharing image, ownership proof, texts manifest and
  published version leave the bundle (leftovers from the site).
- Outdated comments in `capacitor.config.ts` and App.vue brought back in
  line with the code.

### Dead code removed

Eleven `window.confirm`s replaced by the app's modal (`useConfirm`), the
actions of `useZmanimLocation` renamed (`locateDevice`, `selectCity`,
`resetPlace`: they are not composables), the canonicals and share links
based on `SITE_URL` in fourteen views (they gave `capacitor://localhost` in
the app), five DOM-less tests moved to the node environment.

Google sign-in flow through redirect (six methods and the useless round
trip of `getRedirectResult` when the sign-in page mounts),
`getPermissionStatus` and `sendTest` of the push service (the Cloud Function
`sendTestNotification` remains, callable by hand), `updateSerie`,
`getSeriesForAuteur`, the `Guest` interface, the `isReserving` prop (never
fed, tested in six expressions), the « succès » ("success") state of a
message never reached (`NewSession`), the `readingNavSections` store
(written, never read), the body's `menu-open` class (no CSS rule), an
always-false RTL condition in the language picker, a duplicate
`applySessionSeo`.

## 2. Recommended open work (not done here)

> Part of this work is handled in the September 2026 review (continued),
> see `docs/audit-review-2026-09-suite.md`.
>
> Status in October 2026 (`docs/audit-performance-2026-10.md`): the guest
> booking rule also let a guest add or remove any other field of a session
> (take it over, hide it), fixed there; item 3 of "Firestore cost" (the
> `no-cache` header against the social preview) is covered by explicit
> headers on the rewritten routes; the whole `sessions` collection is now
> read only by the share page (and the guest migration at sign-in).

By order of value. Each line gives the entry point; each one has its task in
the project's Notion database.

### Security and data

1. **Bookings editable by anyone** (`firestore.rules`, rules
   `isUpdateReservationOnly` / `isRemoveOneReservationOnly`). Without an
   account, any client can rewrite a chain's `reservations` array at
   constant size or remove one from it, their own or someone else's; on the
   interface side, typing another guest's email is enough to get their
   buttons (`canUserDeleteReservation` compares with the typed email). It is
   a deliberate choice (guest identity by email, without an account), but it
   is the most exposed point of the model. Way out: subcollection
   `sessions/{id}/reservations/{rid}` with ownership by uid or guest
   identifier checked by the rules, or a callable for mutations. Data
   migration to plan.
3. **Hidden chains still readable** (`allow read: if true`): hiding exists
   only on the client side. `allow get` conditioned on `hidden` after
   backfilling the field.
4. **Unpublished chiourim listable** with their audio URL
   (`chiourFirestoreRepository`, `chiourim` rules). `allow list` on
   `published == true`, and a callable for the studio's drafts.
5. **Orphaned studio uploads** (`storage.rules`, `studioUploads/`): no
   purge. GCS lifecycle rule to set by hand and to record.
6. **Third-party emails in the bundle** (`src/config/analyticsAudience.ts`):
   compare hashes, or set `user_type` on the server side.
7. **App Check** on the callables (studio, test notification).
8. **Service account key with unlimited lifetime** in the GitHub secrets:
   Workload Identity Federation.

### Firestore cost (grows with usage)

1. **The whole `sessions` collection on every visit** (`firestoreService`,
   `getSessions`) and **on every sign-in** (`migrateGuestReservations`,
   called three times from the sign-in page). `where` on `isEnded`,
   `orderBy` + `limit`, bookings as a subcollection or a counter; guest
   migration from the already loaded cache, and only if a local identifier
   exists.
2. **Daily reminder: scan of all profiles every five minutes**
   (`functions/src/dailyReminder.ts`). Denormalize a slot
   (`pushReminderSlot`) on the client side and query on it; precompute the
   chkia slot once a day.
3. **Social preview in front of human traffic**: check in production that
   the `Cache-Control: no-cache` header of the `**` block in `firebase.json`
   does not override the functions' header (`curl -sI` on a chiour page);
   if it does, dedicated `headers` blocks for the rewritten routes.
4. `getChiourim()` (whole catalog) in the function for author pages; the
   safety net for legacy documents has had no purpose since the migration.

### Weight and startup

1. **Entire `fr.ts` in the entry** (18 kB gzip, of which ~12 kB are
   namespaces of lazy pages): split by namespace and merge on route entry,
   as for en and he. Gain ~10 kB gzip on every first page.
2. **`seoPages.ts` as a single chunk** (35 kB gzip) loaded in full by every
   content page (legal notice included): helpers in a small module, contents
   per family and per language via `import()`.
3. **Blocking Google fonts in the app**: the native shell waits for
   `fonts.googleapis.com` before the first render (captive portal, slow
   network). Ship Inter and Frank Ruhl Libre as subsetted woff2 (~150 kB)
   and remove the Google link from `app.html`. OFL licenses.
4. **Native `TextZoom`**: set `setTextZoom(100)` in `MainActivity` rather
   than after mount (visible reflow on Android with an enlarged system
   font), and remove the plugin.
5. `widgetService.init()` to be run after `router.isReady()` and
   `requestIdleCallback` (the payloads are already imported on demand).
6. A single build per PR (`ci.yml` and `preview.yml` make two);
   `firebase-tools` pinned; real `lastmod` in the sitemap (today the build
   date on 1,465 URLs).

### Smoothness

1. **Booking index**: `TextStudiesList` and `SessionManagementPage` now each
   have their own; merge them into a `useReservationIndex(session)`
   composable.
2. **Three scroll listeners** on a reading page (ScrollToTop, ReadingMenu,
   ReadingProgressBar): a shared `useScrollFrame()`.
3. **Navbar blur** (`backdrop-blur-md`) re-rasterized on every scroll frame
   on mobile; keep it only for fine pointers.
4. Remaining progress bars with an animated `width` (session cards, daily
   reading, audio player): same switch to `scaleX`.

### Native app

1. **Android back button blind to overlays**: introduction, confirmation
   dialog, modals and reading menu do not close on the back gesture, which
   navigates underneath or minimizes the app. A stack of handlers
   (`useBackHandler`) consulted before `router.back()`.
2. **Downloaded texts backed up to iCloud** (`Directory.Data` = Documents on
   iOS, ~40 MB that can be downloaded again): possible rejection reason
   (guideline 2.23). Set `NSURLIsExcludedFromBackupKey` on
   `Documents/texts` from the Swift plugin.
3. **Rachi of the paracha never downloadable**: pruned from the bundle but
   absent from the offline books; the Rachi option of chnei mikra fails
   without network.
4. White flash at Android launch: `setBackgroundColor(TRANSPARENT)` on the
   WebView in `setup-android.mjs`, so the window's day/night background shows
   through.

### Quality and debt

- **Four components of more than a thousand lines** (`DailyReading`,
  `TextReadingPage`, `SessionManagementPage`, `DetailSession`). The
  prerequisite is to extract what is written several times: session editing
  and ending (four copies), booking from the reader (copy of
  `DetailSession`), catalog filtering, the theme / fonts / appearance
  triptych of the preference composables (~150 identical lines).
- **`sessionService`**: delegation facade to `reservationService`,
  `SearchService`, `TextTypeService`, `DateService` (more than twenty
  one-line methods), while the views also call `reservationService`
  directly.
- **Hard-coded French strings** in translated views (« Session
  introuvable », « Utilisateur », SEO titles of internal pages).
- Tooling: `scripts/*.mjs` neither linted nor typed; `noUnusedLocals`
  missing; all tests in jsdom, including those that do not need it; `knip`
  in CI would find dead exports. Those this review cited have been handled:
  `READING_LEAD_SOLO` and `hubHeading` (`src/content/etudeTexts.ts`),
  `localePrefix` (`seoLocales.ts`), `CITY_NAMES` (`zmanimCities.ts`),
  `PARASHA_FR/EN/HE` (`parashaStrings.ts`) and `ZMANIM_GUIDE_FR/EN/HE`
  (`zmanimGuideStrings.ts`) are no longer exported and are used within their
  own module.

## 3. Product ideas

- **Creator dashboard** on the management page: who booked what, who has
  read nothing; the data is already there (`sessionGuests`).
- **Link to a verse**: `?verset=N` works in the reader, but no action
  copies it; the selection button only offers the bookmark.
- **New chain**: the book selection starts with everything checked, hence
  chains of 2,700 dafim by default; explicit choice or a warning.
- **Chain not found**: untranslated message and no way back to sharing;
  offline, the booking bar disappears without explanation.
- **Notifications**: after a permanent refusal, offer « Ouvrir les
  réglages » ("Open settings"); slip "2 readings out of 3 left" into the
  reminder and deep-link to the first unread text (the function already
  reads the progress).
- **Trilingual widgets** (`values-en` / `values-iw` resources,
  hard-coded `openAppFallback`); Android "essential times" widget and
  library shortcuts (the payload already exists on the Android side).
- **Missing settings** in the app: "download only on Wi-Fi" (or a
  confirmation above 5 MB), "clear offline texts" (`removeBooks` exists).
- **Introduction**: merge Library and Offline; ask for location from the
  Horaires (Times) page (the most useful permission for widgets).
- **Purge of resolved reports** older than 90 days (the backoffice reads the
  whole collection).
