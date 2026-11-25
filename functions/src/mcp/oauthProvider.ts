/**
 * The MCP server's own OAuth 2.1 authorization server, behind the SDK's
 * handlers (dynamic client registration, authorize, token, revoke).
 *
 * - Anyone may register a client (claude.ai does it on its own when the
 *   connector is added), but no client gets a token without the owner: the
 *   authorize step shows the consent page (consentPage.ts), and only a
 *   Firebase ID token of the owner's account (owner.ts) turns it into a code.
 * - PKCE (S256) is mandatory; the SDK checks the verifier against the
 *   challenge kept with the code.
 * - Codes live 5 minutes and are used once; access tokens live an hour;
 *   refresh tokens 30 days, rotated at each use, and refused once the owner's
 *   account is disabled or no longer the owner's.
 * - Every token is bound to this server (RFC 8707 resource) and to the scopes
 *   the owner approved (scopes.ts).
 */
import { createHash, randomBytes } from "node:crypto";
import type { Response } from "express";
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  AccessDeniedError,
  InvalidClientMetadataError,
  InvalidGrantError,
  InvalidRequestError,
  InvalidTargetError,
  InvalidTokenError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { renderConsentPage } from "./consentPage";
import { approvedScopes, narrowScopes, offeredScopes, SCOPES, type Scope } from "./scopes";
import type { McpStore } from "./store";

export const CODE_TTL_S = 5 * 60;
export const REQUEST_TTL_S = 10 * 60;
export const ACCESS_TTL_S = 60 * 60;
export const REFRESH_TTL_S = 30 * 24 * 60 * 60;

interface PendingRequest {
  clientId: string;
  clientName: string;
  redirectUri: string;
  codeChallenge: string;
  state: string | null;
  scopes: Scope[];
  expiresAt: number;
}

interface CodeRecord {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: Scope[];
  uid: string;
  expiresAt: number;
}

interface TokenRecord {
  kind: "access" | "refresh";
  clientId: string;
  scopes: Scope[];
  uid: string;
  expiresAt: number;
}

/** How the provider learns who the owner is (Firebase Auth in production). */
export interface OwnerCheck {
  /**
   * The account behind a Firebase ID token if it is the owner's, or why it
   * is refused, in words for the consent page (null: refused, no reason).
   */
  verifyOwnerIdToken(idToken: string): Promise<{ uid: string } | { refused: string } | null>;
  /** Whether the account is still the owner's (not deleted, not disabled). */
  isStillOwner(uid: string): Promise<boolean>;
}

export interface ProviderOptions {
  store: McpStore;
  owner: OwnerCheck;
  /** This MCP server's URL, the resource every token is bound to. */
  resource: URL;
  now?: () => number;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function tokenKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sameResource(a: URL, b: URL): boolean {
  const strip = (url: URL) => url.href.replace(/#.*$/, "").replace(/\/$/, "");
  return strip(a) === strip(b);
}

/**
 * Where a client may send the owner back: an https page, or a loopback
 * address for a local client. Never `javascript:` or another scheme: the
 * consent page navigates there from the site's own origin.
 */
export function isSafeRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

export class PjOAuthProvider implements OAuthServerProvider {
  private readonly store: McpStore;
  private readonly owner: OwnerCheck;
  readonly resource: URL;
  private readonly now: () => number;

  constructor(options: ProviderOptions) {
    this.store = options.store;
    this.owner = options.owner;
    this.resource = options.resource;
    this.now = options.now ?? Date.now;
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    const store = this.store;
    return {
      async getClient(clientId: string) {
        if (!clientId || clientId.length > 200) return undefined;
        return store.get<OAuthClientInformationFull>("mcpClients", clientId);
      },
      async registerClient(client) {
        if (!client.redirect_uris.length || !client.redirect_uris.every(isSafeRedirectUri)) {
          throw new InvalidClientMetadataError(
            "redirect_uris must be https URLs (or loopback addresses).",
          );
        }
        const full = client as OAuthClientInformationFull;
        if (!full.client_id) throw new InvalidClientMetadataError("client_id missing.");
        await store.set("mcpClients", full.client_id, full);
        return full;
      },
    };
  }

  private checkResource(resource: URL | undefined) {
    if (resource && !sameResource(resource, this.resource)) {
      throw new InvalidTargetError("This server only grants access to its own MCP endpoint.");
    }
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response) {
    this.checkResource(params.resource);
    if (!isSafeRedirectUri(params.redirectUri)) {
      throw new InvalidRequestError("Unsupported redirect_uri.");
    }
    const requestId = randomToken();
    const scopes = offeredScopes(params.scopes);
    const pending: PendingRequest = {
      clientId: client.client_id,
      clientName: client.client_name ?? "",
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      state: params.state ?? null,
      scopes,
      expiresAt: this.now() + REQUEST_TTL_S * 1000,
    };
    await this.store.set("mcpAuthRequests", requestId, pending);
    res
      .status(200)
      .set("Cache-Control", "no-store")
      .type("html")
      .send(
        renderConsentPage({
          requestId,
          clientName: pending.clientName,
          redirectHost: new URL(params.redirectUri).host,
          scopes: scopes.map((scope) => ({
            scope,
            label: SCOPES[scope].label,
            checked: SCOPES[scope].preselected,
          })),
        }),
      );
  }

  private async takeRequest(requestId: unknown): Promise<PendingRequest> {
    const request =
      typeof requestId === "string" && ID_PATTERN.test(requestId)
        ? await this.store.take<PendingRequest>("mcpAuthRequests", requestId)
        : undefined;
    if (!request || request.expiresAt < this.now()) {
      throw new InvalidRequestError(
        "Cette demande a expiré ou a déjà servi : relancez la connexion depuis l'assistant.",
      );
    }
    return request;
  }

  /**
   * The owner approved on the consent page, ticking what he grants among the
   * offered scopes: returns where to send the browser.
   */
  async approve(requestId: unknown, idToken: unknown, chosen?: unknown): Promise<string> {
    // The account is checked before the request is used, so that signing in
    // with the wrong account first leaves the request open for the right one.
    const verdict =
      typeof idToken === "string" && idToken ? await this.owner.verifyOwnerIdToken(idToken) : null;
    if (!verdict || "refused" in verdict) {
      throw new AccessDeniedError(
        verdict?.refused ?? "Seul le compte propriétaire peut autoriser cet accès.",
      );
    }
    const owner = verdict;
    if (Array.isArray(chosen) && chosen.length === 0) {
      throw new InvalidRequestError("Cochez au moins un accès à accorder.");
    }
    const request = await this.takeRequest(requestId);
    const scopes = approvedScopes(request.scopes, chosen);
    if (!scopes.length) throw new InvalidRequestError("Aucun des accès cochés n'était demandé.");
    const code = randomToken();
    const record: CodeRecord = {
      clientId: request.clientId,
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      scopes,
      uid: owner.uid,
      expiresAt: this.now() + CODE_TTL_S * 1000,
    };
    await this.store.set("mcpCodes", tokenKey(code), record);
    const url = new URL(request.redirectUri);
    url.searchParams.set("code", code);
    if (request.state) url.searchParams.set("state", request.state);
    return url.href;
  }

  /** The owner refused: the client hears `access_denied`. */
  async deny(requestId: unknown): Promise<string> {
    const request = await this.takeRequest(requestId);
    const url = new URL(request.redirectUri);
    url.searchParams.set("error", "access_denied");
    if (request.state) url.searchParams.set("state", request.state);
    return url.href;
  }

  private async liveCode(client: OAuthClientInformationFull, code: string): Promise<CodeRecord> {
    const record = await this.store.get<CodeRecord>("mcpCodes", tokenKey(code));
    if (!record || record.clientId !== client.client_id || record.expiresAt < this.now()) {
      throw new InvalidGrantError("Invalid or expired authorization code.");
    }
    return record;
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, code: string) {
    return (await this.liveCode(client, code)).codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    code: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    this.checkResource(resource);
    const record = await this.store.take<CodeRecord>("mcpCodes", tokenKey(code));
    if (!record || record.clientId !== client.client_id || record.expiresAt < this.now()) {
      throw new InvalidGrantError("Invalid or expired authorization code.");
    }
    if (redirectUri !== undefined && redirectUri !== record.redirectUri) {
      throw new InvalidGrantError("redirect_uri does not match the authorization request.");
    }
    return this.issueTokens(client.client_id, record.scopes, record.uid);
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL,
  ): Promise<OAuthTokens> {
    this.checkResource(resource);
    const record = await this.store.take<TokenRecord>("mcpTokens", tokenKey(refreshToken));
    if (
      !record ||
      record.kind !== "refresh" ||
      record.clientId !== client.client_id ||
      record.expiresAt < this.now()
    ) {
      throw new InvalidGrantError("Invalid or expired refresh token.");
    }
    if (!(await this.owner.isStillOwner(record.uid))) {
      throw new InvalidGrantError("The account that approved this access can no longer grant it.");
    }
    const kept = narrowScopes(record.scopes, scopes);
    if (!kept.length) throw new InvalidGrantError("No scope left to grant.");
    return this.issueTokens(client.client_id, kept, record.uid);
  }

  private async issueTokens(clientId: string, scopes: Scope[], uid: string): Promise<OAuthTokens> {
    const accessToken = randomToken();
    const refreshToken = randomToken();
    const now = this.now();
    const access: TokenRecord = {
      kind: "access",
      clientId,
      scopes,
      uid,
      expiresAt: now + ACCESS_TTL_S * 1000,
    };
    const refresh: TokenRecord = {
      kind: "refresh",
      clientId,
      scopes,
      uid,
      expiresAt: now + REFRESH_TTL_S * 1000,
    };
    await Promise.all([
      this.store.set("mcpTokens", tokenKey(accessToken), access),
      this.store.set("mcpTokens", tokenKey(refreshToken), refresh),
    ]);
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TTL_S,
      refresh_token: refreshToken,
      scope: scopes.join(" "),
    };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const record = token
      ? await this.store.get<TokenRecord>("mcpTokens", tokenKey(token))
      : undefined;
    if (!record || record.kind !== "access" || record.expiresAt < this.now()) {
      throw new InvalidTokenError("Invalid or expired access token.");
    }
    return {
      token,
      clientId: record.clientId,
      scopes: record.scopes,
      expiresAt: Math.floor(record.expiresAt / 1000),
      resource: this.resource,
    };
  }

  async revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest) {
    const key = tokenKey(request.token);
    const record = await this.store.get<TokenRecord>("mcpTokens", key);
    if (record && record.clientId === client.client_id) await this.store.delete("mcpTokens", key);
  }
}
