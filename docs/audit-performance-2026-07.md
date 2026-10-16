# Performance audit (July 2026)

> Note: the initial report spoke of a "white site" (a voice dictation
> error); the actual symptom is a **slow site**. Section 1 (HTML cache →
> white screen after deployment) remains a real bug confirmed by Error
> tracking and the fixes are kept, but the cause of the report is to be
> found in section 0.

Context: after PostHog was added, a tester reported that the site had become
**slow**, across the whole site, on desktop and phone, while the owner sees
nothing on their machine. This audit covers: the plausible causes of a
general slowness, the real impact of PostHog tracking, and a full inventory
(bundle, Firestore, functions, rendering).

## 0. General slowness on a given device: suspects and mitigations

A slowness that affects *all* pages for one user (but not for everyone)
points to what runs continuously, not to a particular page. In order of
probability:

1. **PostHog session replay**, costs CPU during the *whole* visit: rrweb
   observes and serializes every DOM mutation. Imperceptible on a recent
   machine, noticeable on a low-end phone or an old laptop. → **Re-enabled,
   except on machines in degraded rendering** (`useDevicePerf` verdict
   persisted in localStorage); if the FPS probe reaches its verdict during
   the session, recording stops immediately. Product events, Error tracking
   and Web Vitals remain active everywhere. Additional setting without
   redeployment: sampling (PostHog → Settings → Session replay → sampling).
2. **The SVG illustrations in infinite animation**, CONFIRMED by a Firefox
   Profiler trace (the problem does not reproduce in Chrome): 154 CSS
   animations active over the session, the site's thread constantly woken up
   (~18 repaints/s while idle), input delays up to 136 ms. Two aggravating
   factors: `illu-flow` animates `stroke-dashoffset`, which Firefox cannot
   composite on the GPU (SVG repaint on every frame), and
   `IllustrationProfil` (infinite sparkles) lives in AccountCta, shown to
   signed-out visitors on several pages, hence "the whole site" being slow.
   → **Fixed**: the idle loops of the 4 illustrations are finite (2-3
   iterations, ~10 s of life after entry, ending on the resting state); the
   hover animations, self-limiting, remain infinite.
3. **The animated stone wall** (`StoneWallBackground.vue`), two halos of
   60/45 vmax in infinite animation behind a full-screen SVG mask, on all
   pages, plus a `backdrop-filter: blur(12px)` on the sticky search bars
   above a background that moves constantly: the blur is recomputed on
   every frame even without interaction. A decisive aggravating factor in
   Firefox: if the GPU is on the driver blocklist, Firefox renders in
   **software** (Software WebRender); mask, backdrop-filter and animated
   gradients are then rasterized on the CPU on every frame, while Chrome
   keeps acceleration → "slow in Firefox but not in Chrome", with a main
   thread almost idle in the profiler (the cost lives in the GPU process,
   absent from the provided trace). A structural aggravating factor in
   Gecko, independent of hardware: Firefox re-rasterizes the SVG mask
   (1600×1100 blurred) and the feTurbulence grain on every tick as long as
   content moves behind it (Mozilla bug 1860510), so freezing the halos is
   not enough. → **Fixed** (`StoneWallBackground` + `useDevicePerf`):
   - **Firefox: wall rasterized once into a `<canvas>`** (resting halos +
     mask + grain composited into pixels), **synchronous** decision, no slow
     frame at startup. No more SVG to repaint; Chrome/Safari keep the
     animated version.
   - Other browsers: same raster rendering when rendering is degraded:
     (a) few cores/little RAM, (b) software WebGL renderer
     (llvmpipe/SwiftShader...) or none, (c) rAF probe < 40 fps. The probes'
     verdict is **persisted in localStorage**: subsequent visits start
     directly in lightweight mode.
   - The `perf-lite` class also turns off backdrop-filters (navbar + sticky
     bars) on these machines. Each trigger sends `perf_degraded_rendering`
     (reason + renderer) to PostHog.
4. **The audio mini-player**, `currentTime` (global ref) was published
   ~4×/s during the whole playback → continuous re-renders on all pages as
   long as a chiour is playing (and as many DOM mutations to serialize for
   the replay). → **Fixed**: published when the second changes (1 Hz).
5. **The weight of the initial load** (§4) and **full Firestore reads**
   (§1); they make every *navigation* slow on a weak connection, without
   explaining an interaction slowness on their own.

To make all this measurable: Core Web Vitals are now captured (INP in
particular measures real interaction slowness, per page and per device),
PostHog → Web analytics → Web vitals after deployment.

- **Fixed (October 2026), on the site:** Firebase Auth kept the account in
  IndexedDB, whose persistence polls its database every 800 ms (25
  transactions in 20 s on the idle home page). `src/firebase/core.ts` puts
  localStorage first, which follows the other tabs through the `storage`
  event (in a mobile browser, Firebase rereads localStorage every second, a
  synchronous read that is much lighter); IndexedDB stays in the list, and
  an account it still holds is found there and then moved. Held by
  `src/__tests__/authPersistence.test.ts` and the e2e « un compte gardé dans
  IndexedDB par une version précédente reste connecté » ("an account kept in
  IndexedDB by a previous version stays signed in").

## 1. The white screen: HTML cache + hashed chunks (fixed)

**PostHog is not to blame.** The mechanism:

1. Each Vite build generates JS chunks with a hash in the name
   (`AdminChiourimPage-uB4ZZNbv.js`). On each deployment, the old files
   disappear.
2. `firebase.json` defined **no** `Cache-Control` for the HTML: Firebase
   Hosting then applies `max-age=3600` by default. A browser could
   therefore keep for up to 1 h an HTML that references deleted chunks
   → 404 on the main module → blank page, on all the devices of a user who
   visited the site just before a deployment.
3. Same problem during a session: a tab open on the old version gets
   "Failed to fetch dynamically imported module" when navigating to a
   lazy-loaded page. **Confirmed in PostHog Error tracking** (active issue
   from 2026-07-28 on `AdminChiourimPage-uB4ZZNbv.js`).

Fixes applied:

- `firebase.json`: `Cache-Control: no-cache` on `**` (the HTML is
  revalidated on every visit; the `/assets/**` blocks, immutable 1 year,
  and `/texts/**`, 7 days, come after and therefore keep priority, since
  the Firebase rule is "the last matching block wins"). Images at the root
  (favicons, og-image) keep a one-day cache.
- `src/main.ts`: `vite:preloadError` listener; if a chunk cannot be found
  after a deployment, the page reloads once (60 s guard in sessionStorage
  so as not to loop while offline).

Good to know: Error tracking only sees errors *after* PostHog has loaded
(prod + consent granted). A white screen on initial load will never show
up in PostHog; the no-cache on the HTML is the real protection.

## 2. Does PostHog slow the site down? Not the tracking; only the replay weighs

The integration (`src/services/analyticsService.ts`) already follows best
practices:

- loaded **only in prod**, through a **dynamic import**, after the app is
  mounted: the SDK (~76 kB gzip) never blocks the first render;
- subject to **consent**: most anonymous visitors who decline load nothing
  at all;
- all methods are no-ops if the SDK is not loaded (adblock, network
  failure): no call can break the app.

The only truly expensive item on the client side is **session replay**
(rrweb recording: continuous CPU + network during the whole visit). Active,
except on machines in degraded rendering (see §0); if it needs to be
lightened further, use sampling, and never touch product events, which
cost nothing.

Addition made: `capture_performance: { web_vitals: true }` → PostHog's
**Web analytics → Web vitals** tab will give field measurements
(LCP/INP/CLS/FCP) page by page to make the rest of this audit measurable.

## 3. Identified performance problems (by priority)

> Status (end of the performance PR): everything below is **fixed**, except
> (a) the Firestore denormalization of `sessions` (`participantIds`), which
> requires a coordinated data migration, out of scope for a front-end PR,
> and (b) pre-splitting the texts by chapter, which affects offline mode and
> deserves its own tested PR. Details of the fixes in the PR description.

### Priority 1. Firestore: reads of entire collections

| Where | Problem |
| --- | --- |
| `src/services/firestoreService.ts:94` | `getDocs(collection(db, "sessions"))` without `where`/`limit`: the **entire** collection (with the full `reservations` arrays) is downloaded. Used by the home page, the profile and the session list → the cost grows with the site's total usage, not with what the user sees. |
| `src/views/HomeView.vue:55`, `ProfilePage.vue:74` | Everything is loaded then filtered on the client to find the user's 2-3 sessions. Fix: denormalized `participantIds` field + `array-contains`, or a `where("personId", "==", uid)` query. |
| `src/services/reservationService.ts:379` | `migrateGuestReservations` does a **full scan on every login** (called 3× from `loginView.vue`), even without a guest booking. Fix: only run it if a local guest id exists + targeted query. |
| `src/views/Chiourim/DetailChiour.vue:116` | A visitor opening a shared chiour link downloads the whole catalog to find one document. Fix: `getDoc(doc(db, "chiourim", slug))`. |
| `src/views/ShareReading/NewSession.vue` | **Fixed (October 2026)**: choosing Tehilim read the whole collection to offer the perpetual chain. A `where("perpetual", "==", true)` query is enough (`sessionService.getPerpetualSession`, held by `perpetualSessionQuery.test.ts`). |
| `src/services/sessionService.ts:243` | `generateUniqueSlug`: one Firestore query per iteration until a free slug is found. Fix: short random suffix. |

### Priority 2. Functions: `socialPreview` in front of human traffic

- `firebase.json` routes `/share-reading/session/**` **and** `/chiourim/**`
  to the `socialPreview` function: every human visit to these pages (the
  most shared URLs of the site) pays a cold start + a Firestore query + a
  `fetch` of the shell before the first byte of HTML.
- `functions/src/index.ts:27`: **global** `maxInstances: 3`; a traffic
  spike on a WhatsApp link puts visitors in a queue.
- Fixes: reserve the rewrite for crawler user agents (or prerender),
  `maxInstances` per function + `minInstances: 1` on `socialPreview`,
  `getDoc` by slug instead of the whole catalog, move the font loading
  (1.23 MB of TTF) out of the per-request path in `ogCard.ts`.

### Priority 3. Reading texts: whole files for one chapter

- `textService.ts:238`: reading **one chapter** downloads and parses the
  file of the whole tractate (up to **1.76 MB**, `shabbat.json`), with 9
  regex passes over the whole tractate. Very heavy on mobile.
- `DailyReadingItem.vue:36`: each daily reading entry loads its full file
  in parallel when the profile mounts (~5 MB for 3 tractates).
- Fix: pre-split the corpora by chapter/daf at build time
  (`scripts/download-texts.mjs`) and only fetch the requested section; load
  the profile items when opened (accordion/IntersectionObserver).
- **Fixed (October 2026):** a file shared by several texts is now read only
  once. The 150 psalms live in `tehilim.json` (1.2 MB); the daily Tehilim
  (up to nine psalms) reread and reparsed it nine times, about 690 ms on a
  desktop computer, and the reader once more for each following psalm.
  `loadText` keeps the last two files read, already parsed; a failure is not
  kept. Held by `src/__tests__/textFileCache.test.ts`.

### Priority 4. Initial bundle and rendering

- `firebase` chunk: **872 kB (214 kB gzip)** loaded from the home page
  (App.vue imports `auth` statically). Lead: split `firestore`/`storage`
  out of the chunk, and defer what is not auth. → **Fixed (2026-08)**:
  `firebase.ts` split into `src/firebase/{core,firestore,storage,functions}.ts`
  - only the core (app + auth, 201 kB / 40 kB gzip) stays in the initial
  bundle, Firestore and the rest load on demand. Preloaded JS:
  321 → 143 kB gzip.
- `index.html`: **render-blocking** Google Fonts stylesheet with 7 families
  / 19 weights; all the selectable alternatives are downloaded by every
  visitor. Fix: keep only the default families as blocking, load the others
  on demand from `useFonts.ts`.
- `sessionService.ts:16` imports `textStudies.json` (64 kB) statically → it
  lands in the initial bundle via the home page. Fix: dynamic import.
- `i18n.ts`: the 3 locales (92 kB of source) are all in the initial bundle.
  Fix: load only the active locale, `import()` the others.
- `seoPages.ts` (94 kB) is pulled into the chunks of `DetailSession`,
  `DetailChiour` and `ProfilePage` **just for the `SITE_URL` constant**.
  Fix: move `SITE_URL` into a small `src/config/site.ts`.
- **Fixed (October 2026):** since the locales arrive through `import()`,
  the app mounted without waiting for its own: in `en-US`, first paint at
  396 ms still in French, English at 482 ms; in `he-IL`, right-to-left
  French then the whole page laid out again. Outside French, `main.ts`
  waits for `localeReady` (one second at most) before `app.mount`. Held by
  `src/__tests__/localeBeforeFirstRender.test.ts`.

- **Fixed (October 2026):** the site's home page pulled the full Firestore
  SDK (671 kB, 173 kB gzip, a listening channel, IndexedDB reread every four
  seconds) just for the team's announcements. On the site, they are read
  through Firestore Lite (`src/firebase/firestoreLite.ts`); the native app
  keeps the full SDK and its offline cache. The small module both share now
  has its own chunk (`firebase-bloom`, in `vite.config.ts`); left in
  `firebase-firestore`, it caused the whole SDK to load. Held by
  `src/__tests__/announcementsFirestoreLite.test.ts`.

### Priority 5. Rendering large lists

- `TextStudiesList.vue`: `isReserved()` / `getReservation()` etc. are
  functions called from the template → recomputation in O(cards × sections
  × bookings) on every keystroke in the search (150 cards for a Tehilim
  chain). Fix: precompute a `Map` per session in a `computed`.
- `useAudioPlayer.ts:94`: `currentTime` (singleton ref) updated ~4×/s during
  the whole playback → continuous re-renders wherever the mini-player is
  mounted. Fix: throttle to ~1 Hz.
- `TextReadingPage.vue:723`: `transliterate(line)` called in the template,
  never memoized. Fix: `computed` per section.

### Healthy points (nothing to do)

- No leaking `onSnapshot`; caches with TTL and deduplication of in-flight
  requests in `firestoreService`/`chiourService`/`serieService`.
- No heavy image (max 76 kB); illustrations as inline SVG.
- All routes except the home page are lazy-loaded.
- `ChiourimPage.vue`: cache-first pattern done well.
