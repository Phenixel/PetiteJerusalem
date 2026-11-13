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
  // La même suspension, troisième formulation : WebKit tue la transaction
  // elle-même, et la lecture qui tournait dessus échoue avec « Attempt to get
  // a record from database without an in-progress transaction ». Vu en
  // rafales de neuf exceptions dans la même seconde, sans aucune pile, sur
  // l'app iOS (page des horaires, v3.10.11, le 9 octobre 2026, puis encore en
  // octobre et novembre). L'app ne tient aucune base IndexedDB à elle : ce
  // sont les lectures du SDK Firebase (persistance d'Auth, cache local de
  // Firestore), et la base revient au lancement suivant. L'opération tentée
  // varie (« get a record », « iterate a cursor »…), la fin de la phrase non.
  /without an in-progress transaction/i,
  // Firestore interrompt son propre flux réseau quand il le démonte (une page
  // quittée alors qu'un écouteur est actif) : `abort()` sans raison, le
  // navigateur fabrique alors ce DOMException, et le rejet remonte non géré.
  // Toute la pile est dans le SDK, que le build garde dans un chunk à part
  // (`firebase-firestore`, voir les manualChunks de vite.config.ts) ; aucune
  // de nos frames. Nos propres AbortController ne peuvent pas le produire :
  // `pause` (perpetualChain) se RÉSOUT à l'abandon, elle ne rejette jamais.
  // Vu sur le site (Chrome, Windows), sur /share-reading et /chiourim, les
  // deux pages qui chargent le SDK complet ; il rouvre son canal tout seul.
  // Une lecture qui échoue vraiment lève une FirestoreError, que ce motif ne
  // touche pas. Le message exact, ancré, pour qu'une vraie erreur qui le cite
  // reste visible.
  /^AbortError: signal is aborted without reason\.?$/,
  // « Script error. » : une erreur cross-origin que le navigateur masque
  // entièrement (ni message réel, ni pile, mécanisme synthétique). Le site ne
  // charge aucun script cross-origin (les polices Google sont du CSS) : elle
  // ne peut venir que d'un script injecté, extension ou webview tierce, sur
  // lequel il n'y a aucune prise. Le message exact, sans rien autour, pour ne
  // pas écarter une vraie erreur qui le citerait.
  /^Script error\.?$/,
  // La boucle de ResizeObserver (« loop completed with undelivered
  // notifications ») n'est volontairement PAS ici : celle des pages de
  // prière venait du panneau des modes calmes, qui écrivait la mise en page
  // depuis son propre rappel, et se corrige dans l'app (PrayerQuietPanel).
  // Si elle revient ailleurs, il faut aller voir l'observateur en cause.
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
