# Global review: security, performance, code quality (November 2026)

The owner asked for a review of the whole site on three axes (security,
performance, cleanliness of the code) and a proposal for improvement. Three
readings were made in parallel on `main` as of 13 November 2026 (commit
`8cf8f50b`), each finding checked in the code and measured where it could be:
the response headers and the web vitals on the production site, the weight of
every chunk on a local build, the field figures in PostHog (75th percentile
over 30 days).

It follows the July performance audit (`audit-performance-2026-07.md`), the
September reviews (`audit-review-2026-09.md`, `audit-review-2026-09-suite.md`)
and the October audit (`audit-performance-2026-10.md`), whose pull request
(#369) had stayed open and is folded into this one. Their open items were
checked first: what was announced as left to do and still is appears in
section 3.

## 1. The state of things

No critical hole: no way to become admin or author, no secret in the
repository, no cross-site scripting found (`v-html` only on content of the
repository, Sefaria texts and user messages rendered as text). The rules deny
by default and the admin fields are closed to session owners.

The real risks are elsewhere:

- **The integrity and privacy of the reading chains.** Reservations are an
  array inside the session document. The rules can only count its entries:
  anyone, without an account, can rewrite it. And a guest's email is stored
  in that public document.
- **Cost.** Public endpoints with no App Check, and a trigger whose cost grew
  with the square of the number of reports.
- **Weight.** The JS preloaded by every page went from 143 kB gzip in August
  to 230 kB; opening a psalm loaded 594 kB of JS gzip.
- **A few very large files** that concentrate the changes, the reader first
  (3,229 lines, 111 commits in 90 days, no test mounts it).

What is sound deserves saying, because it explains why the list above is
short: zero `any`, zero `eslint-disable` and zero `TODO` in `src/`, no
circular import, 0.18% of duplicated code, the same 2,691 keys in the three
languages, no `onSnapshot` listener left open, caches with a shared in-flight
request, HTML never cached and hashed assets immutable, analytics loaded only
with consent, 2,400 unit tests with no `skip`.

## 2. Fixed in this PR

### Security

- **A session's link could be taken over** (medium). A slug carried by
  several sessions goes to the oldest one, and `createdAt` was written by the
  client with no bound: a session created today with the slug of a chain
  already shared, dated in the year 2000, took its links and its social
  preview; with `guestEmailRequired` it then collected emails. The rules now
  refuse a creation date more than one hour old and keep it from moving
  afterwards (`createdAtNotBackdated`, `createdAtUntouched`). The app writes
  the server time; released apps write the device clock, which the hour
  covers. A released app whose clock runs more than an hour late can no
  longer create a chain until it is updated: the price of closing the hole.
- **The same takeover without backdating** (medium, found by the new rules
  tests). The owner of an old session could give it the slug of a newer one:
  the slug going to the oldest session, the links followed. A slug is now
  set once (`slugUntouched`); only a legacy session without one may still
  receive it. The app has not changed a slug since 3.5.2; an older app that
  renames a session is refused.
- **The date of a report had no type** (medium, found by the same tests):
  anyone, without an account, could store close to 1 MiB in `createdAt`, as
  often as wanted, in a collection the back office reads in full. It must
  now be a timestamp.
- **A report cost as much as all the reports before it** (high). Creating a
  report is open to everyone, and `onSessionReported` read back every open
  report of the session each time: a script posting N reports cost about
  N²/2 reads, on a chain that never hides itself (the perpetual one). The
  open reports are now counted by an aggregation first and read back only
  while they are few (300, `functions/src/reportTally.ts`); past that,
  accounts are read apart from guests. Nothing changes below the limit.
- **The page of a message could link to another site** (low). The field is
  written by the sender and shown to the admin as a link; `/\host` passed
  the check and browsers read the backslash as a slash. Refused by the
  function, and the back office resolves the stored value against the
  site's origin (`appPageHref`).
- **Deleting an account left its threads behind past 500** (medium):
  `forgetSupportThreads` used one batch, which failed, and the error was
  swallowed. Batches of 400 now.
- **A missing asset answered 200 with the app shell** (low). The catch-all
  rewrite covered `/assets`, `/fonts` and `/texts`: a chunk gone after a
  release came back as `text/html`, immutable for a year. These folders now
  answer 404.
- **Two response headers** on every page: `Cross-Origin-Opener-Policy`
  (`same-origin-allow-popups`, which sign-in by popup needs), and the part of
  a content security policy that needs no inventory of the scripts
  (`base-uri`, `object-src`, `frame-ancestors`).
- **Private text in the session replay** (low). The replay masked inputs
  only. What a template marks with `data-ph-mask` is now masked too: the
  messages written to the team, the account's email, the whole back office.
- **Emails of third parties in the public bundle** (low, open since
  September). `src/config/analyticsAudience.ts` now holds the SHA-256 of
  each address.

### Performance

- **Layout shift on every page but the home page.** The app mounted before
  its first route had loaded: the navbar over an empty page, the footer right
  under it, then everything pushed down. Measured in production: 0.56 on
  `/bibliotheque`, 0.56 on a Talmud page, 0.81 on `/horaires` (0.25 is
  already poor); in the field, 0.60 to 0.75 at the 75th percentile on the
  reader and the calendar. The first render now waits for the first route,
  one second at most, and the footer waits for it without limit.
- **The reader and the sign-in page no longer wait for Firestore.** Both
  imported statically a service that brings the whole SDK (about 170 kB
  gzip). It now comes with the first reading chain in the reader, and after
  sign-in on the form. Held by `initialBundle.test.ts`.
- **What #369 brought** (see `audit-performance-2026-10.md` for the detail):
  the social preview cached by the CDN again and its shell revalidated every
  minute, the audio player, the auto-scroll pill and the feature tour loaded
  on first appearance, the back office's French messages loaded by `/admin`,
  the office no longer rebuilt every 30 seconds while one prays, the
  `series` collection no longer read by every reading page, the home page
  reading only the announcements it can show, and the bug fixes listed
  there (Talmud chapters, reminder time zone, weekday objectives, two
  races).

### Code quality and tooling

- **CI no longer fixes what it checks.** `npm run verify` ran
  `eslint --fix`: a fixable fault was fixed in the working copy, thrown
  away, and the job stayed green. It now runs `lint:check` and, new,
  `format:check` (Prettier was verified nowhere; eight files of `src/`
  were not formatted).
- **The Cloud Functions and the scripts are linted.** `functions/src` was
  ignored, and the scripts (23,000 lines, `admin.mjs` among them) only had
  the TypeScript rules. Fifty hits in the scripts, one of them real.
- **Promises nobody awaits are marked.** `no-floating-promises` and
  `no-misused-promises`, with type information, on `src/`: 74 calls now say
  `void`, as the code already did elsewhere. No behaviour changes. Lint is
  about four times slower (6 s to 25 s), brought back to about 14 s by
  `--concurrency`.
- **Five TypeScript options** that already passed, or within one error, are
  on in the four projects: `noUnusedLocals`, `noUnusedParameters`,
  `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`.
- **The platform constants left `composables/`.** `useNativeApp.ts` was two
  constants that 19 services imported; they live in `config/platform.ts`.
- **Capacitor 8.4.3**, past a critical advisory on 8.4.1
  (GHSA-rvm3-566m-v7fv: remote content loaded at the app origin). The fix
  reaches users with the next app release. `@hebcal/core` is pinned to the
  exact version its patch targets. `npm audit fix` in `functions/` leaves 8
  advisories out of 16, all under `firebase-admin` 12 (the fix is a major
  update, not done).
- **Workflows**: third-party actions pinned to a commit (they receive the
  Play key and the production service account), `firebase-tools` pinned in
  one variable per workflow, `permissions: contents: read` written where
  no block existed.

### Tests

- **The security rules are held on the emulator.** They were tested for the
  perpetual chain only. `e2e/firebase/rules.spec.ts` proves over REST, with
  no browser, what each of the 13 blocks allows and refuses (50 tests, five
  seconds, in the `firebase` project of the end to end suite). The known
  limit of the reservation array is written down there as a test, so that
  the day the model changes the test is changed on purpose.
- Writing it found the two holes closed above (the slug that could change,
  the date of a report with no type).
- New unit tests hold each fix: `reportTally.test.ts`, the page of a message
  in `support.test.ts`, the hosting configuration, the static imports of the
  reader and the sign-in page, the audience list.

### Documentation

- `docs/architecture.md`: a map of the repository, the direction of the
  dependencies and the two rules that keep it (no `firebase/*` outside
  services, no composable imported by a service). There was none.

## 3. Open work, by priority

### 3.1 The reservation model (high, needs a migration)

Three findings share one cause, the `reservations` array inside the session
document, and one remedy.

1. **Reservations can be rewritten without an account.** The third branch of
   the `update` rule on `sessions` asks for no authentication and checks
   only the size of the array (plus one to a hundred, minus one, or equal).
   Anyone can replace every name of a chain, flip `isCompleted`, or remove
   entries one by one. On the perpetual chain, 150 entries marked read with
   the real identifiers end the round: the function empties the chain and
   adds one to its counter, with no way back. The rules cannot do better
   with an array: a client reads it, changes it and writes it whole, and a
   booking may also prune up to two expired draws, so not even "append
   only" can be required.
2. **A guest's email is public.** `resolveGuestId` stores the email typed by
   a guest in `chosenByGuestId`, in a document everyone can read and list.
   The owner of a chain that requires an email does want to see it; nobody
   else should.
3. **The whole `sessions` collection is read** by `/share-reading`, by every
   sign-in (to move a guest's reservations to the account) and by the back
   office, arrays included: about 200 kB for one full Nichmat chain.

The remedy is one document per reservation, `sessions/{id}/reservations/{rid}`,
which the rules can protect (the author's uid, or a guest identifier fixed at
creation and never shown), with the guest's email in a field only the chain's
owner reads, and a small summary on the session (counts, last activity) kept
by a function. It cannot land in one step, because released apps write the
array:

1. A function mirrors the array into the sub-collection (and back), so both
   shapes stay true.
2. The app reads and writes the sub-collection; the round of the perpetual
   chain is counted from it, by the server.
3. Once the app versions that write the array are gone, the rules close the
   array. Today the app only suggests an update (the "Update available"
   banner of `docs/app-native.md`): a minimum version would have to be
   enforced first.
4. The array is removed, and with it the full reads: `/share-reading` lists
   sessions by two bounded queries.

Until then, the rules validate nothing inside a reservation: a hundred
arbitrary entries per write, 5,000 in all.

### 3.2 Other security work

- **App Check** (medium, open since September). No function and no rule
  requires it. It needs the console (reCAPTCHA Enterprise for the web, App
  Attest and Play Integrity for the apps), then `enforceAppCheck` on the
  callables. Until then, the rate limit of `submitFeedback` is the only
  brake, and it lives in memory, per instance, keyed on an address the
  caller may be able to forge (`X-Forwarded-For`; suspected, not tested).
- **Three throwaway accounts hide any session** (medium). Sign-up asks for
  no verified address. Counting only verified or week-old accounts is the
  owner's call: it also silences honest reporters who signed up by email.
- **Sessions and profiles are not bounded** (medium). `validSessionFields`
  checks five fields but not that there are no others (`hasOnly`), and
  `userPreferences` has unbounded maps. Listing the fields every released
  app writes comes first; a wrong list locks people out.
- **Drafts of lessons are public** (medium, open since September):
  `chiourim` is readable in full, drafts and their audio URL included.
  Closing it means the released apps' unfiltered query is refused: to do
  once a minimum app version is enforced, or by moving drafts to their own
  collection.
- **Production still deploys with a long-lived JSON key** where staging uses
  Workload Identity Federation; pull request previews are deployed to the
  production project.
- **A full content security policy.** `script-src` needs an inventory
  (PostHog, Firebase Auth, the two inline scripts of `index.html`) and a
  period in `Report-Only`. A report endpoint would receive addresses and
  URLs before consent: to weigh.
- **Account deletion leaves traces**: the sessions created, the
  reservations in other people's chains, the names of the perpetual chain,
  the reports and the PostHog profile. A server-side trigger on account
  deletion should anonymise or remove them; what to keep of a chain whose
  creator leaves is a product decision.
- **Names of the perpetual chain**: a `refoua` name with the mother's name
  is health data about a third party, listable without an account, with no
  cap per account. To state in the privacy policy at least.
- **The studio link** never expires and travels in the URL; uploads have no
  quota per link and are never purged.
- Low: push tokens are not validated (`fcmTokens`, `pushToken` of a guest
  thread), votes and view counters can be stuffed (accepted), HSTS without
  `preload`, no `security.txt`, `allowBackup` on the Wear app, and the iOS
  location string says the position "is sent nowhere" while the reminder
  before chkia stores a place.

### 3.3 Performance

- **French messages by area** (about 20 to 25 kB gzip of the entry chunk,
  estimated). `fr.ts` is a third of the entry chunk; `parcours`,
  `textReading`, `zmanim` and `tips` could load with their routes. A visitor
  in English or Hebrew downloads French and their language.
- **Google Fonts**: a render-blocking stylesheet on a third-party origin,
  loaded before any consent, in the native shell too. Hosting Manrope,
  Playfair Display and the Latin of Frank Ruhl Libre under `/fonts` removes
  the dependency and the privacy question at once.
- **The lessons of a text still bring the full SDK** to the reader, after
  the first render (`TexteChiourim` asks Firestore which lessons study the
  open text). A static index of the texts that have a lesson, or a read
  through Firestore Lite, would spare it to visitors.
- **A translated Talmud chapter is rendered in one block**: up to 22,000 DOM
  elements (Sukkah 5). `content-visibility: auto` per daf, to test against
  the code that reads positions (anchors, resume, study table).
- **A whole book is downloaded for one chapter** (Shabbat: 243 kB brotli,
  567 kB more with the translation), after the manifest. Starting both from
  the route guard is the small step; one file per chapter the large one.
- **The daily reminder reads every subscribed profile every five minutes**
  (288 times the number of profiles per day) and sends one after another.
- `minInstances: 1` on `socialPreview` (cold start: 3 s to first byte), the
  prayer names of the chain read in full on every mount, the whole lesson
  catalog read for one series or one author, index exemptions for the large
  arrays (`sessions.reservations`, `parcours.days`).

### 3.4 Code quality

- **`TextReadingPage.vue`** (3,229 lines, eleven subjects). The section
  headings already in the file give the split: `useReaderRoute`,
  `useReaderOccasions`, `useReaderTranslation`, `useReaderNavigation`,
  `useReadingResume`, `useReaderTable`, `useReaderStudyPanel`,
  `useSessionReservation` (shared with `DetailSession.vue`, which copies
  it), `useRandomDraw`, `useReaderSeo`. Reservation and draw first (640
  lines, isolated); a test that mounts the page before anything.
- **Still open from September**: the reservation logic copied between the
  reader and `DetailSession.vue`, five modals outside `AppModal`, the eight
  delegations left in `sessionService`.
- **`zmanimService.ts` (1,917 lines) and `textService.ts` (1,770)**: a
  dozen subjects each. Split into `services/zmanim/` and `services/text/`
  with the original file kept as a re-export, as `services/parcours/` did.
- **Rules copied between `src/`, `functions/` and `scripts/`** with no test
  comparing them: the slug of a lesson (five copies), "will this write send
  a notification" (three), the timestamp helpers (eight), the daily reading
  count (the client copy is now dead). A `shared/` folder compiled on both
  sides, or a parity test per rule.
- **Firestore documents cast without validation** (`as ChiourDoc`...) in a
  dozen places, where `parseAnnouncement` and `toPrayerName` show the way.
- **`localStorage` read raw in 31 files**, each with its own `try/catch`
  (the source of most of the 88 `catch` blocks holding only a comment): a
  `safeStorage` helper under `devicePreference`.
- **The catalog of texts** cast in 18 files
  (`(textStudiesJson as TextStudiesJson).textStudies`): one typed module.
- **State colors have no token**: 225 palette classes (`text-red-*`,
  `text-green-*`, `text-amber-*`) with their dark pair repeated, and the
  "stone" tints copied as hex in five components.
- **Tests**: 298 files flat in one folder, `createApp` rewritten in 75 of
  them, no shared mount helper; 16% of components and 22% of views are
  imported by a test; no coverage figure.
- `noUncheckedIndexedAccess` (314 errors in 86 files) and 14 exports that
  only their tests keep alive.

## 4. What was not verified

- The console: API key restrictions, Auth providers, budget alerts, the
  bucket's lifecycle rule, IAM roles, two-step verification on the admin
  account, and that the deployed rules are those of the repository.
- No measurement on a real phone, in Safari or in Firefox: the rendering
  costs above are estimated from volumes.
- The gains announced for open performance work are estimates.
- The native apps were not built: the Capacitor update is checked by the
  type-check and the unit tests only.
