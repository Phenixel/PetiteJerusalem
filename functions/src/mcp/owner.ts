/**
 * Who may connect an assistant to the MCP server: the owner's account, the
 * same one the Firestore rules call admin (`isAdmin()` in firestore.rules,
 * kept in step by src/__tests__/mcpServer.test.ts).
 *
 * Pure module, read by the site's unit tests.
 */

export const OWNER_EMAILS = ["admin@phenixel.fr"] as const;

/** A decoded Firebase ID token, or a user record: only these fields count. */
export interface OwnerCandidate {
  email?: string | null;
  email_verified?: boolean;
  emailVerified?: boolean;
  disabled?: boolean;
}

export function isOwner(account: OwnerCandidate | null | undefined): boolean {
  if (!account || account.disabled) return false;
  const verified = account.email_verified === true || account.emailVerified === true;
  const email = (account.email ?? "").toLowerCase();
  return verified && (OWNER_EMAILS as readonly string[]).includes(email);
}

/** The claims of a decoded Firebase ID token that the consent step reads. */
export interface OwnerIdClaims extends OwnerCandidate {
  uid: string;
  /** Issued at, in seconds since the epoch. */
  iat: number;
}

/** How fresh the ID token behind an approval must be (the page asks for a new one). */
export const OWNER_TOKEN_MAX_AGE_S = 5 * 60;

export type OwnerVerdict = { uid: string } | { refused: string };

/**
 * Whether the account behind a freshly decoded ID token may approve, and if
 * not, why, in words for the consent page: the person reading it is the one
 * signed in, so naming their own address tells them which account to switch
 * to. The token must be recent: the page forces a refresh before posting,
 * and Firebase refuses that refresh to a disabled or signed-out account, so a
 * recent token stands for a live session without a call to the Auth API.
 */
export function ownerVerdict(claims: OwnerIdClaims, nowSeconds: number): OwnerVerdict {
  const email = (claims.email ?? "").toLowerCase();
  if (!(OWNER_EMAILS as readonly string[]).includes(email)) {
    return {
      refused: email
        ? `Connecté avec ${email} : ce n'est pas le compte propriétaire. Changez de compte.`
        : "Ce compte n'a pas d'adresse e-mail : ce n'est pas le compte propriétaire.",
    };
  }
  if (!isOwner(claims)) {
    return {
      refused: `L'adresse ${email} n'est pas marquée comme vérifiée par Firebase Auth : l'accès ne peut pas être accordé.`,
    };
  }
  if (!(nowSeconds - claims.iat <= OWNER_TOKEN_MAX_AGE_S)) {
    return { refused: "La connexion date de trop longtemps. Réessayez." };
  }
  return { uid: claims.uid };
}
