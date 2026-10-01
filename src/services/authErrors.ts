import { AppError } from "./appError";

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

/** Les fournisseurs de connexion tiers, pour les vues comme pour ce module. */
export type SocialProvider = "google" | "apple";

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
 *
 * Le même code sort aussi d'un build mal configuré (entitlement « Sign in
 * with Apple » absent du profil, capability retirée de l'identifiant). Cette
 * panne-là touche tout le monde d'un coup, sans passer par l'Error tracking :
 * elle se lit dans le funnel, `apple_signin_failed` avec la raison
 * `unavailable` qui prend soudain toute la place des `signed_in` Apple.
 */
export function isAppleSignInUnavailable(error: unknown): boolean {
  return /AuthenticationServices\.AuthorizationError\D*1000\b/.test(messageOf(error));
}

/**
 * Ce que l'appareil ne sait pas faire, quel que soit le fournisseur : Safari
 * hors d'atteinte pour Google, feuille Apple imprésentable. Ni un refus ni un
 * bug de l'app : réessayer ne change rien, seul le repli par email aboutit.
 * Les appelants affichent quoi vérifier, comptent le décrochage dans le
 * funnel, mais ne remontent pas ces échecs à l'Error tracking.
 */
export function isAuthProviderUnavailable(provider: SocialProvider, error: unknown): boolean {
  switch (provider) {
    case "google":
      return isAuthBrowserUnavailable(error);
    case "apple":
      return isAppleSignInUnavailable(error);
    default: {
      // Un fournisseur ajouté au type sans sa règle ne compile pas, plutôt
      // que de tomber en silence sur celle d'Apple.
      const unhandled: never = provider;
      return unhandled;
    }
  }
}

/**
 * Erreurs propres aux flux de compte de l'app, à côté de celles de Firebase.
 *
 * Comme celles-ci, elles portent un `code` : les vues trient dessus
 * (SecuritySettings) et useToast.errorFromException y cherche la clé de son
 * message traduit (`errors.<code>`). Le message reste un libellé technique
 * pour les journaux ; aucune vue ne l'affiche.
 */
export type AuthErrorCode =
  | "googleSignInIncomplete"
  | "appleSignInIncomplete"
  | "appleReauthIncomplete"
  | "noCurrentUser"
  | "emptyDisplayName";

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  googleSignInIncomplete: "Connexion Google annulée ou incomplète",
  appleSignInIncomplete: "Connexion Apple annulée ou incomplète",
  appleReauthIncomplete: "Ré-authentification Apple annulée ou incomplète",
  noCurrentUser: "Aucun utilisateur connecté",
  emptyDisplayName: "Le nom d'affichage ne peut pas être vide",
};

export class AuthFlowError extends AppError {
  constructor(code: AuthErrorCode) {
    super(code, AUTH_ERROR_MESSAGES[code]);
    this.name = "AuthFlowError";
  }
}

/**
 * Le même code que Firebase (`auth/requires-recent-login`), levé par l'app
 * quand elle vérifie elle-même l'ancienneté de la session avant une action
 * sensible : l'écran de suppression propose alors de se reconnecter, sans
 * distinguer d'où vient le refus.
 */
export class RecentLoginRequiredError extends Error {
  readonly code = "auth/requires-recent-login";
  constructor() {
    super("auth/requires-recent-login");
    this.name = "RecentLoginRequiredError";
  }
}

/** Le code Firebase (`auth/...`) d'une erreur, ou celui d'une erreur de l'app. */
export function authErrorCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  return typeof code === "string" ? code : null;
}

/**
 * Ce que l'écran de connexion dit d'un échec par email ou mot de passe.
 *
 * Il affichait le message brut de Firebase (« Firebase: Error
 * (auth/invalid-credential). »), en anglais dans une app en français. Chaque
 * code connu reçoit sa phrase (`login.errors.*`), et l'écran propose la sortie
 * qui va avec (`help`) :
 *
 *  - `signup` : la connexion refuse une adresse qui n'a peut-être pas de
 *    compte ; on propose de le créer avec elle ;
 *  - `provider` : sur cet appareil, la dernière connexion s'est faite avec
 *    Google ou Apple (voir lastAuthMethod) ; on propose ce bouton-là ;
 *  - `login` : l'inscription refuse une adresse déjà inscrite ; on propose de
 *    s'y connecter.
 *
 * Firebase ne sait pas dire si l'adresse existe (protection contre
 * l'énumération des comptes) : la phrase couvre donc les deux cas, compte
 * absent ou créé avec Google, sans prétendre savoir lequel.
 */
export type EmailAuthHelp = "signup" | "login" | "provider";

export interface EmailAuthErrorView {
  /** La clé du message, dans `login`. */
  key: string;
  /** La sortie proposée, ou null. */
  help: EmailAuthHelp | null;
}

/** Les codes d'un couple adresse et mot de passe refusé, selon l'âge du SDK. */
const INVALID_CREDENTIAL_CODES = new Set([
  "auth/invalid-credential",
  "auth/invalid-login-credentials",
  "auth/wrong-password",
  "auth/user-not-found",
]);

const EMAIL_AUTH_MESSAGE_KEYS: Record<string, string> = {
  "auth/email-already-in-use": "login.errors.emailInUse",
  "auth/weak-password": "login.errors.weakPassword",
  "auth/invalid-email": "login.errors.invalidEmail",
  "auth/missing-email": "login.errors.invalidEmail",
  "auth/missing-password": "login.errors.missingPassword",
  "auth/too-many-requests": "login.errors.tooManyRequests",
  "auth/network-request-failed": "login.errors.network",
  "auth/user-disabled": "login.errors.userDisabled",
};

/** Toutes les clés que `describeEmailAuthError` peut rendre (tenues par un test). */
export const EMAIL_AUTH_ERROR_KEYS: readonly string[] = [
  "login.errors.invalidCredential",
  "login.errors.invalidCredentialGoogle",
  "login.errors.invalidCredentialApple",
  ...new Set(Object.values(EMAIL_AUTH_MESSAGE_KEYS)),
  "login.loginError",
];

export function describeEmailAuthError(
  code: string | null,
  lastMethod: "google" | "apple" | "email" | null,
): EmailAuthErrorView {
  if (code !== null && INVALID_CREDENTIAL_CODES.has(code)) {
    if (lastMethod === "google") {
      return { key: "login.errors.invalidCredentialGoogle", help: "provider" };
    }
    if (lastMethod === "apple") {
      return { key: "login.errors.invalidCredentialApple", help: "provider" };
    }
    return { key: "login.errors.invalidCredential", help: "signup" };
  }
  if (code === "auth/email-already-in-use") {
    return { key: "login.errors.emailInUse", help: "login" };
  }
  const key = code !== null ? EMAIL_AUTH_MESSAGE_KEYS[code] : undefined;
  return { key: key ?? "login.loginError", help: null };
}
