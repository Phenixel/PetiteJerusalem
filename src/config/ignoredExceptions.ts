/**
 * Exceptions connues et inactionnables, écartées de l'Error tracking PostHog
 * avant envoi (`before_send` dans analyticsService).
 *
 * N'ajouter un motif ici QUE lorsque la cause est comprise et qu'aucun
 * correctif applicatif n'existe : chaque motif documente pourquoi. Tout le
 * reste doit rester visible dans l'Error tracking.
 */
const IGNORED_EXCEPTION_PATTERNS: RegExp[] = [
  // WebKit coupe la connexion IndexedDB d'une page suspendue (retour
  // d'arrière-plan, pression mémoire). Le polling de persistance de Firebase
  // Auth (toutes les 800 ms) rejette alors en boucle : des rafales de
  // $exception non gérées, observées sur l'app iOS comme sur Safari web.
  // Bug amont firebase-js-sdk/WebKit ; la session en mémoire continue de
  // fonctionner et la persistance revient au prochain lancement, rien à
  // corriger côté app.
  /Connection to Indexed Database server lost/i,
  /database connection is closing/i,
  // The same WebKit suspension, seen from the other side: the connection is
  // already gone, so a read started before it lands on a transaction that no
  // longer runs ("UnknownError: Attempt to get a record from database without
  // an in-progress transaction"). Observed on the iOS app as a burst of nine
  // in sixteen milliseconds, with no stack frame at all: none of our code is
  // on the way down, and the store comes back at the next launch.
  /Attempt to get a record from database without an in-progress transaction/i,
  // Firestore cuts its own streaming connection when a listener goes away (a
  // page left, a query replaced) by aborting the request without a reason.
  // The rejection surfaces unhandled, every frame inside the
  // firebase-firestore chunk, none in our code; observed on the website while
  // navigating between two pages that both listen. Upstream firebase-js-sdk:
  // the next listener opens its own connection.
  /^AbortError: signal is aborted without reason$/,
  // The browser could not deliver every resize notification within one frame
  // and says so, in the wording of its engine's version ("loop limit
  // exceeded" on older Chrome, "loop completed with undelivered
  // notifications" since). It is a notification of the specification, not a
  // throw: the event carries a synthetic mechanism and no frame, so it names
  // no observer to go and look at, and the notifications left over are
  // delivered in the next frame. Our own observers already measure inside a
  // requestAnimationFrame (useScrollFrame, useReadingColumn), so nothing
  // stays unmeasured.
  /^ResizeObserver loop (limit exceeded|completed with undelivered notifications)\.?$/,
  // « Script error. » : une erreur cross-origin que le navigateur masque
  // entièrement (ni message réel, ni pile, mécanisme synthétique). Le site ne
  // charge aucun script cross-origin (les polices Google sont du CSS) : elle
  // ne peut venir que d'un script injecté, extension ou webview tierce, sur
  // lequel il n'y a aucune prise. Le message exact, sans rien autour, pour ne
  // pas écarter une vraie erreur qui le citerait.
  /^Script error\.?$/,
];

/**
 * `values` : les messages portés par `$exception_list` (une exception peut en
 * chaîner plusieurs). On n'écarte l'événement que si TOUS relèvent du bruit
 * connu : une vraie erreur qui enveloppe un message connu doit rester visible.
 */
export function isIgnoredException(values: unknown[]): boolean {
  if (values.length === 0) return false;
  return values.every(
    (value) =>
      typeof value === "string" &&
      IGNORED_EXCEPTION_PATTERNS.some((pattern) => pattern.test(value)),
  );
}
