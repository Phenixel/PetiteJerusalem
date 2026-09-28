/**
 * Reconnaître un chunk lazy-loadé devenu injoignable, quel que soit le
 * navigateur qui le signale.
 *
 * Après un déploiement, les chunks changent de hash : un onglet resté ouvert
 * sur l'ancienne version demande un fichier qui n'existe plus. L'hébergement
 * ne répond pas 404 pour autant, puisque la réécriture SPA envoie app.html
 * (voir firebase.json) : le navigateur reçoit un 200 de type text/html là où
 * il attendait du JavaScript. D'où deux familles de messages, selon que le
 * navigateur refuse le fichier avant ou après l'avoir reçu :
 *
 *  - le module est jugé introuvable : « Failed to fetch dynamically imported
 *    module » (Chrome), « error loading dynamically imported module »
 *    (Firefox), « Importing a module script failed » (Safari) ;
 *  - le module arrive, mais avec le mauvais type MIME : « 'text/html' is not
 *    a valid JavaScript MIME type. » (Safari), « Expected a JavaScript module
 *    script but the server responded with a MIME type of "text/html" »
 *    (Chrome), « blocked because of a disallowed MIME type » (Firefox).
 *
 * Seule la première famille était reconnue. La seconde a été observée en
 * production le 24/09/2026 sur Safari iOS : faute d'être reconnue, elle
 * laissait le visiteur devant une page qui ne finit pas de se charger, sans
 * le rechargement qui l'aurait réparée.
 */
const CHUNK_ERROR_PATTERNS: RegExp[] = [
  /dynamically imported module/i,
  /Importing a module script failed/i,
  /is not a valid JavaScript MIME type/i,
  /Expected a JavaScript module script/i,
  /disallowed MIME type/i,
];

/** Le message porté par une erreur, quelle que soit sa forme. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Vrai si l'erreur dit qu'un module hashé n'a pas pu être chargé. */
export function isChunkLoadError(error: unknown): boolean {
  const message = messageOf(error);
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/** Le fichier cité par le message, pour le suivi ; null si le message n'en cite aucun. */
export function chunkNameFrom(error: unknown): string | null {
  const url = messageOf(error).match(/https?:\/\/\S+?\.(?:js|mjs|css)/)?.[0];
  return url ? (url.split("/").pop() ?? null) : null;
}
