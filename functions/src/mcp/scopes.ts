/**
 * What a connected assistant may do through the MCP server, scope by scope.
 *
 * Every tool names the one scope it needs (tools/index.ts), and the server
 * only lists the tools the access token was granted. A new kind of access to
 * the database (writing a reply, reading sessions...) is a NEW scope added
 * here, never a widening of an existing one: the owner sees it on the consent
 * page and approves it explicitly, and tokens granted before it keep their
 * old, narrower rights.
 *
 * Pure module (no firebase-functions, no MCP SDK): the site's unit tests read
 * it (src/__tests__/mcpServer.test.ts).
 */

export const SCOPES = {
  "support:read": {
    /** What the consent page says the assistant will be able to do. */
    label:
      "Lire les messages « Nous écrire » et les réponses de l'équipe, sans les coordonnées des personnes",
    /** Ticked when the consent page opens. Only a scope that reads may be. */
    preselected: true,
  },
  "support:reply": {
    label:
      "Répondre en votre nom aux personnes, dans leur fil « Nous écrire » : une réponse à la fois, sur un fil précis, avec notification",
    preselected: false,
  },
} as const;

export type Scope = keyof typeof SCOPES;

export const ALL_SCOPES = Object.keys(SCOPES) as Scope[];

export function isScope(value: unknown): value is Scope {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SCOPES, value);
}

/**
 * The scopes a request offers on the consent page: the known ones it asks
 * for, or every scope when it asks for none (the owner ticks what he grants).
 * Unknown scopes are dropped rather than refused, so a client asking for
 * `openid` or `offline_access` still connects with what this server offers.
 */
export function offeredScopes(requested: readonly string[] | undefined): Scope[] {
  const known = [...new Set((requested ?? []).filter(isScope))];
  return known.length ? known : [...ALL_SCOPES];
}

/**
 * What the owner granted: the offered scopes he ticked. A page that sends no
 * choice grants only the preselected ones, never a scope that writes.
 */
export function approvedScopes(offered: readonly Scope[], chosen: unknown): Scope[] {
  if (!Array.isArray(chosen)) return offered.filter((scope) => SCOPES[scope].preselected);
  return offered.filter((scope) => chosen.includes(scope));
}

/** A refresh may keep or narrow its scopes, never widen them. */
export function narrowScopes(
  granted: readonly string[],
  requested: readonly string[] | undefined,
): Scope[] {
  const held = granted.filter(isScope);
  if (!requested?.length) return held;
  return held.filter((scope) => requested.includes(scope));
}
