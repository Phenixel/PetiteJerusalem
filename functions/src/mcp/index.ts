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
    { firestoreSupportSource },
    { isOwner },
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
        try {
          // checkRevoked: a session the owner signed out everywhere is refused.
          const decoded = await auth.verifyIdToken(idToken, true);
          return isOwner(decoded) ? { uid: decoded.uid } : null;
        } catch {
          return null;
        }
      },
      async isStillOwner(uid) {
        try {
          return isOwner(await auth.getUser(uid));
        } catch {
          return false;
        }
      },
    },
  });
  return createMcpApp({ provider, context: { support: firestoreSupportSource(db) }, siteUrl });
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
