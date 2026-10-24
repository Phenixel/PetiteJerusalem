/**
 * Known, unactionable exceptions, dropped from PostHog Error tracking before
 * they are sent (`before_send` in analyticsService).
 *
 * Add a pattern here ONLY when the cause is understood and no application fix
 * exists: every pattern documents why. Everything else must stay visible in
 * Error tracking.
 */
const IGNORED_EXCEPTION_PATTERNS: RegExp[] = [
  // WebKit cuts the IndexedDB connection of a suspended page (coming back
  // from the background, memory pressure). Firebase Auth's persistence
  // polling (every 800 ms) then rejects in a loop: bursts of unhandled
  // $exception, observed on the iOS app as well as on Safari web. Upstream
  // firebase-js-sdk/WebKit bug; the in-memory session keeps working and
  // persistence comes back on the next launch, nothing to fix on our side.
  //
  // The same loss reaches us under three wordings. The last one is WebKit
  // invalidating a transaction that Firebase is still reading from, so the
  // read lands on a transaction that is already over: nine rejections in
  // sixteen milliseconds, iOS 18.7, app v3.10.11, on /horaires. We never
  // open IndexedDB ourselves (no `indexedDB.open` anywhere in src): every
  // transaction of ours is Firebase Auth's own persistence.
  /Connection to Indexed Database server lost/i,
  /database connection is closing/i,
  /Attempt to get a record from database without an in-progress transaction/i,
  // The browser telling itself that it stopped delivering resize
  // notifications for the current frame; it resumes at the next one. No
  // message of ours, no stack (a synthetic exception raised through
  // window.onerror), and nothing broken on screen. Our three observers
  // (useAutoScroll, useScrollFrame, useReadingColumn) only read the layout
  // and defer their work to requestAnimationFrame, so none of them can be
  // the loop. Observed on an old Android WebView (Chrome 90), which still
  // uses this wording; Chrome 92 and later word it differently and have
  // never reached us, so that wording is deliberately left visible.
  /^ResizeObserver loop limit exceeded$/,
  // Firestore aborts its own listening stream when it tears its channel down
  // (a page left while a query is in flight): every frame of the stack sits
  // in the firebase-firestore chunk and ends on its `abort`, and the
  // DOMException escapes the SDK as an unhandled rejection. Upstream
  // firebase-js-sdk, and it cannot come from our code: the AbortControllers
  // we own resolve on abort instead of rejecting (`pause` in
  // perpetualChain), and the fetch helpVideos aborts on a timeout is caught
  // by its caller. Observed while navigating from /share-reading to
  // /chiourim.
  /^AbortError: signal is aborted without reason$/,
  // "Script error.": a cross-origin error that the browser hides entirely
  // (no real message, no stack, synthetic mechanism). The site loads no
  // cross-origin script (the Google fonts are CSS), so it can only come from
  // an injected script, an extension or a third-party webview, over which we
  // have no hold. The exact message, with nothing around it, so that a real
  // error quoting it is not dropped.
  /^Script error\.?$/,
];

/**
 * `values`: the messages carried by `$exception_list` (one exception can chain
 * several). The event is dropped only if ALL of them are known noise: a real
 * error wrapping a known message must stay visible.
 */
export function isIgnoredException(values: unknown[]): boolean {
  if (values.length === 0) return false;
  return values.every(
    (value) =>
      typeof value === "string" &&
      IGNORED_EXCEPTION_PATTERNS.some((pattern) => pattern.test(value)),
  );
}
