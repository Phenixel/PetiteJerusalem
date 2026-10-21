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
  // « Script error. » : une erreur cross-origin que le navigateur masque
  // entièrement (ni message réel, ni pile, mécanisme synthétique). Le site ne
  // charge aucun script cross-origin (les polices Google sont du CSS) : elle
  // ne peut venir que d'un script injecté, extension ou webview tierce, sur
  // lequel il n'y a aucune prise. Le message exact, sans rien autour, pour ne
  // pas écarter une vraie erreur qui le citerait.
  /^Script error\.?$/,
  // The Firestore SDK aborting its own channel request. The fetch shim of
  // @firebase/webchannel-wrapper (1.0.6) keeps an AbortController per request
  // and its abort() calls `controller.abort()` with no reason: the browser
  // then builds this very DOMException, and the rejection surfaces as an
  // unhandled one. Seen on 21 October 2026 on the website (Chrome 154,
  // Windows), six times in one visit, on /share-reading and /chiourim, the
  // two pages that load the full SDK: the whole stack sits inside the
  // firebase-firestore chunk and ends on the SDK's abort(), not a single
  // frame of ours. Nothing of ours holds that promise, so nothing of ours can
  // catch it; the SDK re-opens its channel by itself and the pages went on
  // loading. A read that really fails raises a FirestoreError
  // ("unavailable", "permission-denied"), which this pattern does not touch.
  // The exact message, anchored, so a real error quoting it stays visible.
  /^AbortError: signal is aborted without reason\.?$/,
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
