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
  // WebKit does not only lose the IndexedDB connection, it also kills the
  // transaction underneath an open one: a page coming back from the
  // background finds the transaction gone, and every read on it throws. Same
  // cause and same signature as the two patterns above (nine identical
  // events inside the same millisecond, from the Firebase Auth persistence
  // polling), with WebKit's other wording. The app keeps no IndexedDB store
  // of its own: the only user is the Firebase SDK, so there is nothing to
  // correct here either.
  /without an in-progress transaction/i,
  // A ResizeObserver callback whose own work resizes an observed element:
  // the browser stops the delivery loop, reports this, and delivers again on
  // the next frame. Nothing breaks for the reader, and the browser reports
  // it through window.onerror, so the event carries no stack trace and names
  // no code to correct. Observed on an Android System WebView still on
  // Chrome 90, whose implementation predates the fix that made current
  // engines far less eager to report the loop. The two exact wordings, so a
  // real error quoting one stays visible.
  /^ResizeObserver loop limit exceeded$/,
  /^ResizeObserver loop completed with undelivered notifications\.?$/,
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
