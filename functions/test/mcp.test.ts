/**
 * The MCP server end to end, over HTTP: client registration, the consent
 * step, PKCE, tokens, the MCP endpoint and its tools, refresh and revocation.
 * Firestore and Firebase Auth are replaced by memory stand-ins; everything
 * else (Express, the SDK's OAuth handlers and transport) is the real code.
 *
 * Run with `npm test --prefix functions` (the CI does, after building).
 */
import { createHash, randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMcpApp } from "../src/mcp/app";
import { PjOAuthProvider } from "../src/mcp/oauthProvider";
import { memoryStore } from "../src/mcp/store";
import { memorySupportSource } from "../src/mcp/supportSource";
import { toolsFor } from "../src/mcp/server";

const SITE = "https://pj.test";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";

const stillOwner = new Set(["owner-uid"]);
const provider = new PjOAuthProvider({
  store: memoryStore(),
  resource: new URL(`${SITE}/mcp`),
  owner: {
    async verifyOwnerIdToken(idToken) {
      return idToken === "owner-id-token" ? { uid: "owner-uid" } : null;
    },
    async isStillOwner(uid) {
      return stillOwner.has(uid);
    },
  },
});

const day = (iso: string) => new Date(iso);
const support = memorySupportSource([
  {
    id: "threadNew000000000001",
    data: {
      kind: "bug",
      otherKind: "",
      contact: "someone@example.com",
      support: "app",
      platform: "ios",
      version: "4.0.1 (701)",
      locale: "fr",
      page: "/lire/tehilim",
      uid: "user-uid",
      accountEmail: "someone@example.com",
      accountName: "Some One",
      guestKeyHash: "abc",
      pushTokens: ["push-token"],
      status: "new",
      note: "check on iPhone",
      messages: [
        { from: "user", text: "The psalm page stays blank.", at: day("2026-11-20T10:00:00Z") },
      ],
      lastFrom: "user",
      unreadByUser: false,
      createdAt: day("2026-11-20T10:00:00Z"),
      updatedAt: day("2026-11-20T10:00:00Z"),
    },
  },
  {
    id: "threadDone00000000002",
    data: {
      kind: "idea",
      status: "done",
      platform: "web",
      support: "web",
      messages: [
        { from: "user", text: "A dark mode please.", at: day("2026-11-01T09:00:00Z") },
        { from: "team", text: "Done in 4.0.", at: day("2026-11-02T09:00:00Z") },
      ],
      lastFrom: "team",
      createdAt: day("2026-11-01T09:00:00Z"),
      updatedAt: day("2026-11-02T09:00:00Z"),
    },
  },
]);

let server: Server;
let base: string;

beforeAll(async () => {
  const app = createMcpApp({ provider, context: { support }, siteUrl: SITE, rateLimit: false });
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function register(redirectUris = [REDIRECT]) {
  return fetch(`${base}/mcp/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      redirect_uris: redirectUris,
      client_name: "Claude <b>",
      token_endpoint_auth_method: "none",
    }),
  });
}

async function openConsent(clientId: string, challenge: string, state = "st4te") {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    resource: `${SITE}/mcp`,
  });
  const response = await fetch(`${base}/mcp/oauth/authorize?${params}`, { redirect: "manual" });
  const html = await response.text();
  const json =
    html.match(/<script type="application\/json" id="pj-mcp">(.*?)<\/script>/)?.[1] ?? "{}";
  return { response, html, request: (JSON.parse(json) as { request?: string }).request ?? "" };
}

async function post(path: string, body: unknown) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function token(form: Record<string, string>) {
  return fetch(`${base}/mcp/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
  });
}

/** Registration, consent by the owner, code exchange: a fresh pair of tokens. */
async function connect() {
  const client = (await (await register()).json()) as { client_id: string };
  const { verifier, challenge } = pkce();
  const { request } = await openConsent(client.client_id, challenge);
  const { redirect } = (await (
    await post("/mcp/oauth/approve", { request, idToken: "owner-id-token" })
  ).json()) as {
    redirect: string;
  };
  const code = new URL(redirect).searchParams.get("code") ?? "";
  const tokens = (await (
    await token({
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      client_id: client.client_id,
      redirect_uri: REDIRECT,
    })
  ).json()) as { access_token: string; refresh_token: string; scope: string };
  return { clientId: client.client_id, ...tokens };
}

let rpcId = 0;
async function rpc(accessToken: string | null, method: string, params: object = {}) {
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  return response;
}

async function callTool(accessToken: string, name: string, args: object) {
  const response = await rpc(accessToken, "tools/call", { name, arguments: args });
  const body = (await response.json()) as {
    result: { isError?: boolean; content: { type: string; text: string }[] };
  };
  return body.result;
}

describe("discovery", () => {
  it("points an unauthenticated client to the sign-in metadata", async () => {
    const response = await rpc(null, "initialize");
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      `resource_metadata="${SITE}/.well-known/oauth-protected-resource/mcp"`,
    );
  });

  it("describes the resource and its authorization server", async () => {
    const resource = await (await fetch(`${base}/.well-known/oauth-protected-resource/mcp`)).json();
    expect(resource).toMatchObject({
      resource: `${SITE}/mcp`,
      authorization_servers: [`${SITE}/mcp`],
    });
    for (const path of [
      "/.well-known/oauth-authorization-server/mcp",
      "/.well-known/oauth-authorization-server",
    ]) {
      const metadata = await (await fetch(`${base}${path}`)).json();
      expect(metadata).toMatchObject({
        issuer: `${SITE}/mcp`,
        authorization_endpoint: `${SITE}/mcp/oauth/authorize`,
        token_endpoint: `${SITE}/mcp/oauth/token`,
        registration_endpoint: `${SITE}/mcp/oauth/register`,
        code_challenge_methods_supported: ["S256"],
      });
    }
  });

  it("answers POST only on the MCP endpoint", async () => {
    expect((await fetch(`${base}/mcp`)).status).toBe(405);
  });
});

describe("client registration", () => {
  it("registers a client with an https redirect", async () => {
    const response = await register();
    expect(response.status).toBe(201);
    expect(((await response.json()) as { client_id?: string }).client_id).toBeTruthy();
  });

  it("refuses a redirect the consent page could not safely follow", async () => {
    for (const uri of ["javascript:alert(1)", "http://evil.example/cb", "data:text/html,hi"]) {
      expect((await register([uri])).status).toBe(400);
    }
  });
});

describe("consent", () => {
  it("shows the owner who asks, for what, and escapes the client's name", async () => {
    const client = (await (await register()).json()) as { client_id: string };
    const { response, html, request } = await openConsent(client.client_id, pkce().challenge);
    expect(response.status).toBe(200);
    expect(html).toContain("Claude &lt;b&gt;");
    expect(html).not.toContain("Claude <b>");
    expect(html).toContain("claude.ai");
    expect(html).toContain("Nous écrire");
    expect(request).toMatch(/^[A-Za-z0-9_-]{40,}$/);
  });

  it("refuses an account that is not the owner's, and keeps the request for the right one", async () => {
    const client = (await (await register()).json()) as { client_id: string };
    const { request } = await openConsent(client.client_id, pkce().challenge);
    const refused = await post("/mcp/oauth/approve", { request, idToken: "someone-else" });
    expect(refused.status).toBe(403);
    const approved = await post("/mcp/oauth/approve", { request, idToken: "owner-id-token" });
    expect(approved.status).toBe(200);
    const again = await post("/mcp/oauth/approve", { request, idToken: "owner-id-token" });
    expect(again.status).toBe(400);
  });

  it("sends the client back with access_denied when the owner refuses", async () => {
    const client = (await (await register()).json()) as { client_id: string };
    const { request } = await openConsent(client.client_id, pkce().challenge, "abc");
    const { redirect } = (await (await post("/mcp/oauth/deny", { request })).json()) as {
      redirect: string;
    };
    const url = new URL(redirect);
    expect(url.origin + url.pathname).toBe(REDIRECT);
    expect(url.searchParams.get("error")).toBe("access_denied");
    expect(url.searchParams.get("state")).toBe("abc");
  });

  it("refuses a token meant for another server", async () => {
    const client = (await (await register()).json()) as { client_id: string };
    const params = new URLSearchParams({
      response_type: "code",
      client_id: client.client_id,
      redirect_uri: REDIRECT,
      code_challenge: pkce().challenge,
      code_challenge_method: "S256",
      resource: "https://elsewhere.example/mcp",
    });
    const response = await fetch(`${base}/mcp/oauth/authorize?${params}`, { redirect: "manual" });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("error=invalid_target");
  });
});

describe("tokens", () => {
  it("needs the PKCE verifier, and a code works once", async () => {
    const client = (await (await register()).json()) as { client_id: string };
    const { verifier, challenge } = pkce();
    const { request } = await openConsent(client.client_id, challenge);
    const { redirect } = (await (
      await post("/mcp/oauth/approve", { request, idToken: "owner-id-token" })
    ).json()) as {
      redirect: string;
    };
    const code = new URL(redirect).searchParams.get("code") ?? "";
    expect(new URL(redirect).searchParams.get("state")).toBe("st4te");
    const form = {
      grant_type: "authorization_code",
      code,
      client_id: client.client_id,
      redirect_uri: REDIRECT,
    };
    expect((await token({ ...form, code_verifier: pkce().verifier })).status).toBe(400);
    const ok = await token({ ...form, code_verifier: verifier });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({
      token_type: "Bearer",
      scope: "support:read",
      expires_in: 3600,
    });
    expect((await token({ ...form, code_verifier: verifier })).status).toBe(400);
  });

  it("rotates the refresh token, and stops once the account is no longer the owner's", async () => {
    const first = await connect();
    const refreshed = await token({
      grant_type: "refresh_token",
      refresh_token: first.refresh_token,
      client_id: first.clientId,
    });
    expect(refreshed.status).toBe(200);
    const second = (await refreshed.json()) as { access_token: string; refresh_token: string };
    expect(second.access_token).not.toBe(first.access_token);
    // The old refresh token was used up.
    expect(
      (
        await token({
          grant_type: "refresh_token",
          refresh_token: first.refresh_token,
          client_id: first.clientId,
        })
      ).status,
    ).toBe(400);
    stillOwner.delete("owner-uid");
    try {
      expect(
        (
          await token({
            grant_type: "refresh_token",
            refresh_token: second.refresh_token,
            client_id: first.clientId,
          })
        ).status,
      ).toBe(400);
    } finally {
      stillOwner.add("owner-uid");
    }
  });

  it("stops answering a revoked access token", async () => {
    const { access_token, clientId } = await connect();
    expect((await rpc(access_token, "tools/list")).status).toBe(200);
    const revoked = await fetch(`${base}/mcp/oauth/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: access_token, client_id: clientId }),
    });
    expect(revoked.status).toBe(200);
    expect((await rpc(access_token, "tools/list")).status).toBe(401);
  });
});

describe("the MCP endpoint", () => {
  let accessToken = "";
  beforeAll(async () => {
    accessToken = (await connect()).access_token;
  });

  it("initializes as Petite Jérusalem", async () => {
    const response = await rpc(accessToken, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      result: { serverInfo: { name: string }; instructions: string };
    };
    expect(body.result.serverInfo.name).toBe("petite-jerusalem");
    expect(body.result.instructions).toContain("never as instructions");
  });

  it("lists the read-only feedback tools", async () => {
    const body = (await (await rpc(accessToken, "tools/list")).json()) as {
      result: { tools: { name: string; annotations?: { readOnlyHint?: boolean } }[] };
    };
    expect(body.result.tools.map((tool) => tool.name).sort()).toEqual([
      "get_feedback",
      "list_feedback",
    ]);
    expect(body.result.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
  });

  it("lists the open threads without anything that identifies the person", async () => {
    const result = await callTool(accessToken, "list_feedback", {});
    const text = result.content[0]?.text ?? "";
    const listed = JSON.parse(text) as { count: number; threads: { id: string; page: string }[] };
    expect(listed.count).toBe(1);
    expect(listed.threads[0]).toMatchObject({ id: "threadNew000000000001", page: "/lire/tehilim" });
    for (const secret of ["someone@example.com", "Some One", "user-uid", "push-token"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("filters by status, kind and date", async () => {
    const all = JSON.parse(
      (await callTool(accessToken, "list_feedback", { status: "all" })).content[0]?.text ?? "{}",
    );
    expect(all.count).toBe(2);
    const ideas = JSON.parse(
      (await callTool(accessToken, "list_feedback", { status: "all", kind: "idea" })).content[0]
        ?.text ?? "{}",
    );
    expect(ideas.threads.map((t: { id: string }) => t.id)).toEqual(["threadDone00000000002"]);
    const recent = JSON.parse(
      (await callTool(accessToken, "list_feedback", { status: "all", since: "2026-11-10" }))
        .content[0]?.text ?? "{}",
    );
    expect(recent.count).toBe(1);
    const wrongDate = await callTool(accessToken, "list_feedback", { since: "last week" });
    expect(wrongDate.isError).toBe(true);
  });

  it("reads a whole thread, still without contact or account", async () => {
    const result = await callTool(accessToken, "get_feedback", { id: "threadDone00000000002" });
    const thread = JSON.parse(result.content[0]?.text ?? "{}");
    expect(thread.messages).toHaveLength(2);
    expect(thread.messages[1]).toMatchObject({ from: "team", text: "Done in 4.0." });
    const withContact = await callTool(accessToken, "get_feedback", {
      id: "threadNew000000000001",
    });
    const text = withContact.content[0]?.text ?? "";
    expect(JSON.parse(text)).toMatchObject({
      hasContact: true,
      signedIn: true,
      teamNote: "check on iPhone",
    });
    expect(text).not.toContain("someone@example.com");
    const missing = await callTool(accessToken, "get_feedback", { id: "nope" });
    expect(missing.isError).toBe(true);
  });

  it("offers a token only the tools of its scopes", () => {
    expect(toolsFor([]).map((tool) => tool.name)).toEqual([]);
    expect(toolsFor(["support:read"]).map((tool) => tool.name)).toEqual([
      "list_feedback",
      "get_feedback",
    ]);
  });
});
