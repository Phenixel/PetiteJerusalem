# Performance, storage and security audit (October 2026)

A full pass over the site, the app, the Cloud Functions and the Firestore
rules: weight of the first load, execution speed, Firestore and Functions
cost, storage on the device, correctness bugs and security holes. Four
parallel readings (security, Firestore and Functions cost, runtime
rendering, bugs), each finding checked in the code, measured where it could
be, and fixed only with a test that holds it.

It follows the July performance audit (`audit-performance-2026-07.md`) and
the September reviews (`audit-review-2026-09.md`,
`audit-review-2026-09-suite.md`), whose open items it re-checked first.

## 1. Fixed in this PR

### Security

- **Any session could be taken over, hidden or deleted by a guest**
  (critical). The guest booking rule (`onlyReservationsChanged` in
  `firestore.rules`) used `changedKeys()`, which leaves out the keys a write
  adds or removes. Together with a booking, a client without an account
  could delete `personId` and then set it to its own uid (it then owned the
  session and could rename or delete it, the perpetual chain included), add
  `hidden: true` (which its owner cannot undo), remove `perpetual`, or pad
  the document with junk fields. The rule now reads
  `affectedKeys().hasOnly(['reservations'])`. The only client writer
  (`reservationService.updateReservations`) writes `reservations` alone, so
  released apps are not affected. Held by the e2e test « une réservation
  d'invité ne touche à aucun autre champ de la session »
  (`e2e/firebase/perpetualChain.spec.ts`), which fails on the old rule
  (403 expected, 200 received).

### Bugs

- **Talmud chapters several dafim off in every tractate.**
  `scripts/generate-talmud-chapters.mjs` fell back silently on a split
  proportional to the number of mishnayot whenever the chapter starts it
  found did not match the Mishna's count, which was always: Berakhot 2 read
  from 7b instead of 13a, Shabbat 1 ended at 14a instead of 20b. Chains,
  the reader, the prerendered pages and Mon parcours all showed these
  ranges. The generator now reads the local files: a chapter starts after
  the « הדרן עלך » that closes the one before, or, where the corpus lacks
  that marker (Bava Kamma 1, Sanhedrin 5, Horayot 2), on the only
  « מתני׳ » that opens its first mishna; it stops if the count differs.
  Ranges stay contiguous: chapter numbers (bookings) and amud positions
  (Mon parcours programs) do not move. Held by `talmudChapters.test.ts`.
  The app reads this file from its binary (`bundledTexts.json`,
  `authoritative`): the fix reaches it with the next app release.
- **Fixed-time daily reminder in Paris time.** Without the reminder before
  chkia, the app sent no place, and the server read the chosen hour (and
  the day of the "read today" check) in Paris time: 20:00 arrived at 21:00
  in Israel, at 14:00 in New York. The app now writes the device's time
  zone alone into `pushReminderPlace` (`{ tzid }`, no position; the
  25-field cap of the preferences document rules out a new field), which
  `readTimeZone` reads on the server. Older documents keep Paris time.
  Held by `dailyReminderTimeZone.test.ts`.
- **A text objective set to some weekdays was due every day** in the
  projection Mon parcours writes for the older fields
  (`legacyDailyReading.ts`): never tickable, and counted as left to read by
  the evening reminder, the widgets and the watch. It is written as read on
  the days it is not due. Held by `parcoursLegacyDaily.test.ts`.
- **A city picked while the device position was on its way** was replaced
  by the late position (up to twenty seconds), and saved. Held by
  `zmanimLocationRace.test.ts`. The chiour page had the same race on a
  cold load (title, canonical and view count of the previous chiour on the
  next page).
- **Social preview shell kept ten minutes** in a warm instance: after a
  site release, session and chiour pages could reference deleted chunks (a
  blank page, which the CDN could keep). Revalidated every minute with its
  ETag (a 304 without body when nothing changed). `firebase.json` also
  states the function's `Cache-Control` for the two rewritten routes, after
  the catch-all `no-cache` block, so the CDN keeps them whichever header
  Hosting applies.
- Two repository-wide guard tests (`typography`, `translations`) passed the
  default five-second timeout under the load of the full suite.

### Weight of the first load

| Preloaded by `index.html` (gzip) | Before | After |
| --- | --- | --- |
| Entry chunk `index-*.js` | 121 kB | 106 kB |
| CSS | 22.6 kB | 21.2 kB |
| Total (with `vue` and `firebase-core`) | 241 kB | 224 kB |

- The audio player (player, media session, listening progress, covers),
  the auto-scroll pill and its composable, and the home page's feature
  tour load on their first appearance. The loaded track and the scrolling
  flag live in two tiny state modules (`audioPlayerState.ts`,
  `autoScrollState.ts`) that the shell reads. The study table bar stays
  eager: the flight of the first text set aside starts from its watcher.
- The back office's French messages (`src/locales/frAdmin.ts`) load with
  the `/admin` route (`loadAdminMessages`). Held by `adminMessages.test.ts`.
- `initialBundle.test.ts` keeps all of these out of the static graph of
  `main.ts`.

### Execution speed

- **The office was rebuilt every thirty seconds** while one prays: the
  occasions read the reader's clock directly, so each tick gave a new set
  and rebuilt the whole office (Cha'harit: about 4,400 nodes, about 126 ms
  per tick measured in jsdom; 77 ms more to retransliterate it in phonetic
  mode). The clock reaches them through two boolean computeds. Held by
  `liturgyClockStable.test.ts`.
- **The bold openings of a guemara** were re-tokenized for every passage on
  every render (about 10 ms of script on Shabbat's longest chapter, plus a
  re-render of every passage). Worked out once per text. Held by
  `talmudOpeningsOnce.test.ts`.
- The parsed text and its translation (reader, daily reading) are
  `shallowRef`s: replaced as a whole, they no longer put a proxy on every
  line (Tehillim: 7.5 ms per re-render to 0.2 ms, measured).
- The navbar blur is kept for fine pointers (`docs/design.md`, section 7):
  on a touch screen a full-width `backdrop-filter` was redrawn on every
  scroll frame. The September suite review said this was done; it was not.
- The catalog searches of the parcours creation and of the studio wait for
  typing to pause (up to 30 ms per key press on a desktop). Held by
  `debouncedValue.test.ts`.
- The daily reminder keeps its date formatters per time zone instead of
  building three per subscriber every five minutes.

### Firestore reads

- Every reading page read the whole `series` collection for the lessons
  encart, even for texts without a lesson. Read only when a lesson of the
  text belongs to a series. Held by `texteChiourimSeries.test.ts`.
- The home page read up to a hundred announcements on every visit, a number
  that grows with each release. It reads what it can show: the last month
  (existing composite index) and the incidents (equality query). Held by
  `announcementsHome.test.ts`.

## 2. Open work (not done here), by value

### Needs a decision or a production check

1. **Share page: the whole `sessions` collection on every visit**
   (`ShareHomePage.vue`, `firestoreService.getSessions`). A query on
   `dateLimit >= now - 2 days` plus `personId == uid` for the creator's own
   tab needs no index and no migration, **if** every session document has a
   Timestamp `dateLimit` (the rules do not type it; a document without one
   would vanish from the list). First run a read-only count in production
   (`node scripts/admin.mjs` has the credentials); then it ships as a front
   end change, old app versions keeping their full read.
2. **`socialPreview` cold starts** (measured in Web Vitals: FCP p75 2.3 s
   on session links against 1.0 s on static pages, 28 % above 2 s).
   `minInstances: 1` removes them for a few euros a month; a cost decision.
3. **Auto-hiding a session takes three throwaway accounts**
   (`functions/src/moderation.ts`): password accounts are created without
   email verification, and the app never sends one. Counting only verified
   or Google/Apple accounts would weaken auto-hiding for real password
   users; a product decision.
4. **Firestore persistent cache on the site** (`src/firebase/firestore.ts`):
   the multi-tab manager rereads IndexedDB every four seconds while
   Firestore is loaded, and every collection read is written to the
   device's storage. A memory cache on the web would remove both, at the
   cost of losing writes made offline when the tab is closed.
5. **Content-Security-Policy**: none today; no injection found that it
   would stop. Start in `Content-Security-Policy-Report-Only` with a report
   endpoint because of PostHog, Firebase and Google Fonts.

### Front end, safe

1. **One tap re-renders the whole office** (`LiturgyText.vue`, about 84 ms
   on Cha'harit in jsdom) and a whole Tanakh book (`TextReadingPage.vue`,
   Tehillim as one text: 2,527 verses). `v-memo` would help, but the
   templates call many functions whose dependencies are hard to list
   without a stale render; a `LiturgyParagraph.vue` child with explicit
   props is the sturdier way.
2. **`fr.ts` by namespace**: `parcours`, `textReading` and `zmanim` weigh
   about 16 kB gzip of the entry chunk, but 127 files use them, three of
   them in the shell; loading them per route is not deterministic. Each
   namespace would need its own loader imported by the files that use it,
   with a test that enforces it.
3. Turning on a translation re-parses the whole Hebrew file
   (`textService.loadTranslation`, 8 to 12 ms on Shabbat).
4. Infinite decorative animations left: `StreakLight.vue`,
   `ParcoursLamp.vue`, the stone wall halos.
5. Width-animated progress bars left (`GlobalAudioPlayer`, `PlayerSeek`,
   `ChiourTrackRow`, `ResumeTile`, `LibraryOfflineRow`, `ProfileParcours`);
   at most one change a second, low impact.
6. Prayer names of the perpetual card reread in full on every mount
   (`prayerNameService`), twice on a cold start.

### Functions

1. Daily reminder: send in batches (`messaging.sendEach`, 500 per call)
   rather than one profile after another; full scan only at UTC minutes 0,
   15, 30 and 45, and a query on `pushSunsetReminderEnabled` and the
   matching `pushReminderMinute` values otherwise (about two thirds fewer
   reads, no backfill).
2. `getChiourim()` (whole catalog) for author pages in `socialPreview`.

### Content

1. **Tamid's daf labels** start at 2a; in the Vilna Shas the tractate runs
   from 25b. The label comes from the index everywhere (`textService`,
   Mon parcours' `unitLabel`), so a per-tractate offset is needed.
2. `talmud-chapters.json` is `authoritative` in the app (read from the
   binary): a correction such as this one waits for an app release.
   Moving it to `revalidated` would let the app pick it up from the site.

### Security, low

- `submitFeedback` / `replySupportThread` store whatever `pushToken` the
  caller sends; a team reply goes to that device. It needs the victim's
  FCM token, which is secret in practice.
- Reservation elements are not validated by the rules (known item 2.1 of
  the September review): up to a hundred arbitrary elements per write.
