/**
 * The `mcp` Cloud Function: Petite Jérusalem's MCP server, so that an
 * assistant (a Claude connector) can read what the owner allows it to, today
 * the user messages. Served on the site's domain through Firebase Hosting
 * rewrites (firebase.json); see docs/mcp.md.
 *
 * The Express app and the MCP SDK are loaded on the first request only: the
 * other functions share this codebase's entry point and should not pay for
 * them at cold start.
 */
import { onRequest } from "firebase-functions/v2/https";
import type { Express } from "express";

let app: Promise<Express> | null = null;

async function buildApp(): Promise<Express> {
  const [
    { getFirestore },
    { getAuth },
    { createMcpApp, mcpUrls },
    { PjOAuthProvider },
    { firestoreStore },
    { firestoreSupportReplies, firestoreSupportSource },
    { isOwner, ownerVerdict },
  ] = await Promise.all([
    import("firebase-admin/firestore"),
    import("firebase-admin/auth"),
    import("./app"),
    import("./oauthProvider"),
    import("./store"),
    import("./supportSource"),
    import("./owner"),
  ]);
  const siteUrl = process.env.SITE_URL || "https://petite-jerusalem.fr";
  const db = getFirestore();
  const auth = getAuth();
  const provider = new PjOAuthProvider({
    store: firestoreStore(db),
    resource: new URL(mcpUrls(siteUrl).resource),
    owner: {
      async verifyOwnerIdToken(idToken) {
        // Signature, project and expiry only: no call to the Auth API, so no
        // IAM permission is needed here. A signed-out or disabled account is
        // still refused, because ownerVerdict wants a token minted in the
        // last minutes and Firebase refuses to mint one for such an account.
        let decoded;
        try {
          decoded = await auth.verifyIdToken(idToken);
        } catch (error) {
          console.error("mcp owner check: ID token refused", authErrorCode(error));
          return {
            refused: "La connexion n'a pas pu être vérifiée. Reconnectez-vous puis réessayez.",
          };
        }
        const verdict = ownerVerdict(decoded, Math.floor(Date.now() / 1000));
        if ("refused" in verdict) console.warn("mcp owner check: refused", verdict.refused);
        return verdict;
      },
      async isStillOwner(uid) {
        try {
          return isOwner(await auth.getUser(uid));
        } catch (error) {
          // Fails closed. Logged, because a missing permission on the Auth
          // API would otherwise look like a lost owner.
          console.error("mcp owner check: account lookup failed", authErrorCode(error));
          return false;
        }
      },
    },
  });
  return createMcpApp({
    provider,
    context: { support: firestoreSupportSource(db), replies: firestoreSupportReplies(db) },
    siteUrl,
  });
}

/** The Admin SDK's error code, never the token or the message around it. */
function authErrorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "unknown";
}

export const mcp = onRequest({ maxInstances: 2, concurrency: 20 }, async (req, res) => {
  app ??= buildApp();
  try {
    (await app)(req, res);
  } catch (error) {
    app = null;
    console.error("mcp init", error);
    res.status(500).json({ error: "server_error" });
  }
});
