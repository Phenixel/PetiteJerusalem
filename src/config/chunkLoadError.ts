/**
 * Reconnaissance d'un chunk lazy-loadé devenu injoignable, pour le
 * rechargement unique posé dans `main.ts`.
 *
 * Après un déploiement, les chunks changent de hash : une page restée ouverte
 * sur l'ancienne version, ou servie depuis un cache un peu vieux, demande un
 * fichier qui n'existe plus. Le navigateur n'en parle pas toujours de la même
 * façon, et c'est tout l'enjeu de ce filtre :
 *
 *  - échec de chargement franc (404, hors ligne) : le message parle de module
 *    dynamique injoignable ;
 *  - type MIME refusé : la règle de réécriture du hosting (« ** » vers
 *    `/app.html`, voir firebase.json) répond 200 et `text/html` à TOUTE adresse
 *    inconnue, `/assets/index-abc123.js` comprise. Le fichier arrive donc, et
 *    c'est le contrôle de type des modules qui le rejette. Une borne captive
 *    (wifi d'hôtel, portail de connexion) produit la même réponse.
 *
 * Les messages ci-dessous sont ceux des navigateurs, pas notre rédaction.
 */
const CHUNK_ERROR_PATTERNS: RegExp[] = [
  // Chrome : « Failed to fetch dynamically imported module: <url> ».
  // Firefox : « error loading dynamically imported module ».
  /dynamically imported module/i,
  // Safari : « Importing a module script failed. »
  /Importing a module script failed/i,
  // Le HTML de l'application servi à la place du script.
  // Safari : « 'text/html' is not a valid JavaScript MIME type. » C'est le cas
  // observé en production le 24/09, sur un lien de session ouvert dans Safari
  // iOS : la navigation échouait sans rien dire, le visiteur restait sur place.
  /is not a valid JavaScript MIME type/i,
  // Chrome : « Failed to load module script: Expected a JavaScript module
  // script but the server responded with a MIME type of "text/html". »
  /Expected a JavaScript module script/i,
  // Firefox : « Loading module from ... was blocked because of a disallowed
  // MIME type ("text/html"). »
  /disallowed MIME type/i,
];

/** Vrai si le message est celui d'un module de l'application injoignable. */
export function isChunkLoadError(message: string): boolean {
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Le nom du fichier en cause, quand le message porte son adresse. Les messages
 * de type MIME de Safari n'en citent aucune : la propriété part alors à null,
 * l'événement garde la route, qui suffit à retrouver le chunk.
 */
export function chunkNameFrom(message: string): string | null {
  const url = message.match(/https?:\/\/\S+?\.(?:js|mjs|css)/)?.[0];
  return url ? (url.split("/").pop() ?? null) : null;
}
