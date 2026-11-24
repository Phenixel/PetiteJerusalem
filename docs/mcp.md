# The MCP server: an assistant reads the user messages

The site serves a [Model Context Protocol](https://modelcontextprotocol.io)
server at `https://petite-jerusalem.fr/mcp`. Added as a custom connector in
claude.ai (or any MCP client that speaks OAuth), it lets an assistant read
the messages people send through « Nous écrire » (`docs/feedback.md`), to
find the bugs and the screens where people get lost, and propose fixes.

It is built to grow one kind of access at a time. Today it can do exactly
one thing: read the messages, without the contacts. Every new kind of
access to the database is a new scope, added on purpose, that the owner
approves on the consent page.

## What it offers

| Tool | Scope | What it returns |
| --- | --- | --- |
| `list_feedback` | `support:read` | The threads, most recently active first: by default those that still need the team (`new` and `in_progress`); filters `status` (`open`, `all` or one status), `kind` (`idea`, `bug`, `error`, `other`), `since` (ISO date, on the last activity) and `limit` (20 by default, 50 at most). It looks at the 500 most recent threads and says so (`olderNotScanned`) when there are more. |
| `get_feedback` | `support:read` | One thread in full: the messages both ways, the team's private note, the app version, platform, language and page it was sent from, and whether the person is signed in and left a contact. |

Both are read only (`readOnlyHint`). Neither returns what identifies or
reaches the person: no contact, no account email or name, no uid, no device
key, no push token. The assistant learns only `signedIn` and `hasContact`,
which say whether the team can answer. `src/__tests__/mcpServer.test.ts`
and `functions/test/mcp.test.ts` hold this.

The server's instructions tell the assistant that the messages are written
by the public: content to analyse, never instructions to follow.

## Who can connect

Only the owner: the account `admin@phenixel.fr` with a verified email, the
same one `isAdmin()` names in `firestore.rules`
(`functions/src/mcp/owner.ts`, kept in step by `mcpServer.test.ts`). Anyone
else who reaches the consent page is refused, and the request stays open
for the right account.

## How a client connects

The server is its own OAuth 2.1 authorization server, with what claude.ai
expects of a remote connector:

1. The client calls `/mcp` without a token and gets a 401 whose
   `WWW-Authenticate` points to `/.well-known/oauth-protected-resource/mcp`,
   which names the authorization server (`/.well-known/oauth-authorization-server/mcp`).
2. It registers itself (`/mcp/oauth/register`, dynamic client
   registration). Redirect addresses must be `https`, or `http` on the
   machine itself (`localhost`, `127.0.0.1`, `[::1]`).
3. It sends the owner to `/mcp/oauth/authorize` (PKCE `S256` required, and
   a `resource`, when given, must be this server). That page, on the site's
   own domain, says which client asks, where it will send the access, and
   what the access allows, then signs in with Google through Firebase Auth
   (the site's own configuration, `/__/firebase/init.json`).
4. « Autoriser » posts the request and the account's Firebase ID token to
   `/mcp/oauth/approve`. The function checks the token (revocation
   included) and the account, then sends the client back with a code
   valid five minutes, once. « Refuser » sends it back with
   `access_denied`.
5. The client trades the code and its PKCE verifier at `/mcp/oauth/token`
   for an access token (one hour) and a refresh token (30 days). Each
   refresh replaces the refresh token, and is refused once the account is
   no longer the owner's (disabled, email changed).

Tokens are opaque and random; Firestore keeps only their SHA-256 hash.
`/mcp/oauth/revoke` revokes one.

## Where it lives

- The function `mcp` (`functions/src/mcp/`), an Express app: the SDK's
  OAuth handlers and its Streamable HTTP transport, stateless (one server
  per request, JSON answers, no session to keep between instances).
- Hosting rewrites send `/mcp`, `/mcp/**`, and the two discovery documents
  under `/.well-known/` to it, before the app's catch-all, with
  `Cache-Control: no-store`. Being on the site's domain lets the consent
  page sign in with the site's own Firebase Auth, and gives the connector a
  stable address.
- Its data: four collections only the function reads and writes (the
  Firestore rules deny every client by default): `mcpClients` (registered
  clients), `mcpAuthRequests` (consents in progress, ten minutes),
  `mcpCodes` (codes) and `mcpTokens` (hashed tokens). Every short-lived
  document carries an `expireAt` date for a Firestore TTL policy.
- It needs no secret and no key: it uses Firebase Auth and Firestore with
  the functions' service account. `SITE_URL` (in `functions/.env.*`) gives
  the public address, `https://petite-jerusalem.fr` by default.

The tools never see the database: they receive a `SupportSource`
(`supportSource.ts`) that can only read the `support` collection. Firestore
cannot limit a service account to one collection, so this boundary is in
the code, and a new tool that needs more gets a new source, not the
database handle.

## Adding a kind of access

1. Add a scope in `functions/src/mcp/scopes.ts`, with the sentence the
   owner reads on the consent page (`support:write`, `sessions:read`...).
   Never widen an existing scope: tokens granted before keep exactly what
   they had.
2. Write the tool in `functions/src/mcp/tools/`, naming that scope, and
   give it only the narrow source it needs. Mark it `readOnly: false` if it
   writes.
3. List it in `tools/index.ts`. A token sees only the tools of its scopes.
4. Test the pure part from `src/__tests__/mcpServer.test.ts` and the call
   over HTTP in `functions/test/mcp.test.ts`.

The owner then reconnects the connector to approve the new scope.

## For the owner

Nothing to create: no key, no secret.

1. Deploy, with the next release tag (`deploy.yml`) or by hand:
   `firebase deploy --only functions:mcp,hosting --project petite-jerusalem-dev`.
   The function must be deployed for the Hosting rewrites to find it.
2. Optional: in the Firestore console, a TTL policy on the `expireAt` field
   of `mcpAuthRequests`, `mcpCodes` and `mcpTokens`, so expired documents
   are deleted (they are refused anyway).
3. In claude.ai, Settings, Connectors, « Add custom connector »:
   `https://petite-jerusalem.fr/mcp`, no client id or secret (the
   connector registers itself). On connecting, sign in with
   `admin@phenixel.fr` and approve.

To cut access: remove the connector in claude.ai, or delete the documents
of `mcpTokens` (every connected client then has to ask again).
