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
  // Same suspension, third message: WebKit kills the transaction itself, and
  // the read that was running on it fails with "Attempt to get a record from
  // database without an in-progress transaction". Seen as a burst of nine
  // exceptions inside the same second on the iOS app (times page, v3.10.11,
  // October 9, 2026). The wording of the attempted operation varies ("get a
  // record", "iterate a cursor"...), the end of the sentence does not.
  /without an in-progress transaction/i,
  // The ResizeObserver loop, reported by the browser itself: when a resize
  // callback changes the layout again, the specification has the browser
  // report an error to `window.onerror` and deliver the remaining
  // notifications on the next frame. Nothing is broken, nothing is lost, and
  // the notice carries no stack frame at all (synthetic mechanism, no
  // `$exception_list` stacktrace): it cannot even be traced back to a call
  // site. The two wordings are the modern one and the one older Chromium
  // webviews still use. Seen on the Android app, v4.0.0, on the reading
  // pages (October 23 and 26, 2026). If a layout glitch is ever reported on
  // one of those pages, this filter is where to look first.
  /^ResizeObserver loop (limit exceeded|completed with undelivered notifications)\.?$/,
  // Firestore aborts its own network stream when it tears it down (a page
  // left while a listener is live): the rejection is raised inside the SDK,
  // which the build keeps in a chunk of its own (`firebase-firestore`, see
  // the manualChunks of vite.config.ts), and surfaces as an unhandled
  // DOMException with the browser's default reason. Our own AbortControllers
  // cannot produce it: `pause` (perpetualChain) RESOLVES on abort, it never
  // rejects. The exact message, anchored, so a real abort that quotes it
  // stays visible.
  /^AbortError: signal is aborted without reason$/,
  // "Script error.": a cross-origin error the browser hides entirely (no
  // real message, no stack, synthetic mechanism). The site loads no
  // cross-origin script (the Google fonts are CSS): it can only come from an
  // injected script, an extension or a third-party webview, over which there
  // is no hold. The exact message, with nothing around it, so a real error
  // quoting it is not dropped.
  /^Script error\.?$/,
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
