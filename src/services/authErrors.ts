/**
 * Lecture des erreurs des flux de connexion Google/Apple (popup web, plugin
 * natif, feuille Apple). Module pur, sans dépendance Firebase ni Capacitor :
 * les vues trient les échecs sans tirer tout authService, et les tests
 * s'écrivent sans mock.
 */

// Codes Firebase web d'un flux abandonné. La fermeture de la popup
// (auth/popup-closed-by-user) ne contient pas le mot « cancel », d'où la
// liste explicite plutôt qu'un motif sur le message.
const CANCELLED_AUTH_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
]);

// Feuille « Sign in with Apple » refusée : code 1001
// (ASAuthorizationErrorCanceled), dans un message localisé par l'appareil
// (« error 1001 », « erreur 1001 »...). Seuls le domaine et le code sont
// stables d'une langue à l'autre.
const APPLE_CANCELLED = /AuthenticationServices\.AuthorizationError\D*1001\b/;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Connexion abandonnée par l'utilisateur : popup fermée, sélecteur Google
 * quitté (« activity is cancelled by the user. » sur Android, « User
 * cancelled the selector » sur le web), feuille Apple refusée. Un choix, pas
 * une panne : les appelants ne doivent ni la remonter à l'Error tracking, ni
 * afficher de message d'erreur.
 */
export function isAuthCancellation(error: unknown): boolean {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  if (typeof code === "string" && CANCELLED_AUTH_CODES.has(code)) return true;
  const message = messageOf(error);
  return /cancel/i.test(message) || APPLE_CANCELLED.test(message);
}

/**
 * Google Sign-In iOS n'a pas pu présenter sa fenêtre web de connexion :
 * « Unable to open Safari. », remonté par AppAuth quand
 * ASWebAuthenticationSession/Safari est indisponible sur l'appareil
 * (restrictions Temps d'écran, profil géré...). Réessayer ne change rien :
 * il faut orienter vers la connexion par email.
 */
export function isAuthBrowserUnavailable(error: unknown): boolean {
  return /Unable to open Safari/i.test(messageOf(error));
}

/**
 * Feuille « Sign in with Apple » en échec, code 1000
 * (ASAuthorizationErrorUnknown) : l'appareil ne peut pas la présenter, le
 * plus souvent parce qu'aucun compte Apple n'y est connecté. Message
 * localisé par l'appareil, comme le 1001.
 */
export function isAppleSignInUnavailable(error: unknown): boolean {
  return /AuthenticationServices\.AuthorizationError\D*1000\b/.test(messageOf(error));
}
