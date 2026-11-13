/**
 * Known, unactionable exceptions, dropped before they reach the PostHog Error
 * tracking (`before_send` in analyticsService).
 *
 * Only add a pattern here ONCE the cause is understood and no application fix
 * exists: every pattern documents why. Everything else must stay visible in
 * the Error tracking.
 */
const IGNORED_EXCEPTION_PATTERNS: RegExp[] = [
  // WebKit cuts the IndexedDB connection of a suspended page (back from the
  // background, memory pressure). Firebase Auth's persistence polling (every
  // 800 ms) then rejects in a loop: bursts of unhandled $exception, seen on
  // the iOS app as well as on Safari web. Upstream firebase-js-sdk/WebKit
  // bug; the in-memory session keeps working and persistence comes back on
  // the next launch, nothing to fix on our side.
  /Connection to Indexed Database server lost/i,
  /database connection is closing/i,
  // Same suspension, third wording: WebKit kills the transaction itself, and
  // the read running on it fails with "Attempt to get a record from database
  // without an in-progress transaction". Seen as bursts of nine exceptions
  // inside the same second, with no stack frame at all, on the iOS app
  // (times page, v3.10.11, October 9, 2026, and again in October and
  // November). The app keeps no IndexedDB store of its own: these are the
  // Firebase SDK's reads (Auth persistence, Firestore's local cache), and the
  // store comes back on the next launch. The attempted operation varies
  // ("get a record", "iterate a cursor"...), the end of the sentence does not.
  /without an in-progress transaction/i,
  // Firestore aborts its own network stream when it tears it down (a page
  // left while a listener is live): `abort()` with no reason, so the browser
  // builds this DOMException and the rejection surfaces unhandled. The whole
  // stack sits inside the SDK, which the build keeps in a chunk of its own
  // (`firebase-firestore`, see the manualChunks of vite.config.ts); not one
  // frame of ours. Our own AbortControllers cannot produce it: `pause`
  // (perpetualChain) RESOLVES on abort, it never rejects. Seen on the website
  // (Chrome, Windows) on /share-reading and /chiourim, the two pages that load
  // the full SDK; it re-opens its channel by itself. A read that really fails
  // raises a FirestoreError, which this pattern does not touch. The exact
  // message, anchored, so a real error quoting it stays visible.
  /^AbortError: signal is aborted without reason\.?$/,
  // "Script error.": a cross-origin error the browser hides entirely (no
  // real message, no stack, synthetic mechanism). The site loads no
  // cross-origin script (the Google fonts are CSS): it can only come from an
  // injected script, an extension or a third-party webview, over which there
  // is no hold. The exact message, with nothing around it, so a real error
  // quoting it is not dropped.
  /^Script error\.?$/,
  // The ResizeObserver loop ("loop completed with undelivered notifications")
  // is deliberately NOT here: the one on the prayer pages came from the quiet
  // modes panel writing the layout from its own resize callback, and is fixed
  // in the app (PrayerQuietPanel). If it shows up elsewhere, go and look at
  // the observer at fault.
];

/**
 * `values`: the messages carried by `$exception_list` (one exception can chain
 * several). The event is only dropped when ALL of them are known noise: a
 * real error that wraps a known message must stay visible.
 */
export function isIgnoredException(values: unknown[]): boolean {
  if (values.length === 0) return false;
  return values.every(
    (value) =>
      typeof value === "string" &&
      IGNORED_EXCEPTION_PATTERNS.some((pattern) => pattern.test(value)),
  );
}
