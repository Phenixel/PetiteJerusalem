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
