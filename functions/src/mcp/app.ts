/**
 * The MCP server's HTTP side, as an Express app mounted by the `mcp` Cloud
 * Function (index.ts). Firebase Hosting rewrites these paths of the site to
 * it (firebase.json), so everything lives on the site's own domain:
 *
 *   /mcp                                           the MCP endpoint (Streamable HTTP, JSON answers)
 *   /mcp/oauth/{register,authorize,token,revoke}   OAuth 2.1 (SDK handlers, oauthProvider.ts)
 *   /mcp/oauth/{approve,deny}                      the consent page's two buttons
 *   /.well-known/oauth-protected-resource[/mcp]    where to sign in (RFC 9728)
 *   /.well-known/oauth-authorization-server[/mcp]  how to sign in (RFC 8414)
 *
 * See docs/mcp.md.
 */
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { authorizationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/authorize.js";
import { clientRegistrationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/register.js";
import { revocationHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/revoke.js";
import { tokenHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/token.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { OAuthError, ServerError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { renderMessagePage } from "./consentPage";
import type { PjOAuthProvider } from "./oauthProvider";
import { ALL_SCOPES } from "./scopes";
import { createMcpServer } from "./server";
import type { ToolContext } from "./tools/types";

export interface McpAppOptions {
  provider: PjOAuthProvider;
  context: ToolContext;
  /** The site the server answers on ("https://petite-jerusalem.fr"). */
  siteUrl: string;
  /**
   * The SDK's per-instance rate limits (on by default). The tests turn them
   * off: every request comes from the same address there.
   */
  rateLimit?: false;
}

export function mcpUrls(siteUrl: string) {
  const site = siteUrl.replace(/\/$/, "");
  return {
    resource: `${site}/mcp`,
    issuer: `${site}/mcp`,
    authorize: `${site}/mcp/oauth/authorize`,
    token: `${site}/mcp/oauth/token`,
    register: `${site}/mcp/oauth/register`,
    revoke: `${site}/mcp/oauth/revoke`,
    resourceMetadata: `${site}/.well-known/oauth-protected-resource/mcp`,
  };
}

const JSON_RPC_METHOD_NOT_ALLOWED = {
  jsonrpc: "2.0",
  error: { code: -32000, message: "Method not allowed: this server answers POST requests only." },
  id: null,
};

export function createMcpApp(options: McpAppOptions): express.Express {
  const { provider, context } = options;
  const urls = mcpUrls(options.siteUrl);
  // The SDK's limiter counts per address, in this instance's memory: a guard
  // against a script hammering one endpoint, not a quota. Its configuration
  // checks would complain about the proxies in front of the function.
  const rateLimit = options.rateLimit === false ? false : { validate: false };

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);

  const authorizationServerMetadata = {
    issuer: urls.issuer,
    authorization_endpoint: urls.authorize,
    token_endpoint: urls.token,
    registration_endpoint: urls.register,
    revocation_endpoint: urls.revoke,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
    revocation_endpoint_auth_methods_supported: ["client_secret_post", "none"],
    scopes_supported: ALL_SCOPES,
    service_documentation: "https://github.com/Phenixel/PetiteJerusalem/blob/main/docs/mcp.md",
  };
  const protectedResourceMetadata = {
    resource: urls.resource,
    authorization_servers: [urls.issuer],
    scopes_supported: ALL_SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: "Petite Jérusalem",
  };

  const metadata = (body: object) => [
    cors(),
    (_req: Request, res: Response) => {
      res.set("Cache-Control", "no-store").json(body);
    },
  ];
  app.get(
    ["/.well-known/oauth-authorization-server", "/.well-known/oauth-authorization-server/mcp"],
    ...metadata(authorizationServerMetadata),
  );
  app.get(
    ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"],
    ...metadata(protectedResourceMetadata),
  );

  app.use(
    "/mcp/oauth/register",
    clientRegistrationHandler({
      clientsStore: provider.clientsStore,
      // The secret alone opens nothing (a token still needs the owner's
      // consent), and an expired one would silently break the connector.
      clientSecretExpirySeconds: 0,
      rateLimit,
    }),
  );
  app.use("/mcp/oauth/authorize", authorizationHandler({ provider, rateLimit }));
  app.use("/mcp/oauth/token", tokenHandler({ provider, rateLimit }));
  app.use("/mcp/oauth/revoke", revocationHandler({ provider, rateLimit }));

  // The consent page's buttons (same origin: no CORS).
  const consent =
    (action: (body: Record<string, unknown>) => Promise<string>) =>
    async (req: Request, res: Response) => {
      res.set("Cache-Control", "no-store");
      try {
        const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<
          string,
          unknown
        >;
        res.json({ redirect: await action(body) });
      } catch (error) {
        const known =
          error instanceof OAuthError ? error : new ServerError("Internal Server Error");
        const status =
          known instanceof ServerError ? 500 : known.errorCode === "access_denied" ? 403 : 400;
        if (!(error instanceof OAuthError)) console.error("mcp consent", error);
        res.status(status).json(known.toResponseObject());
      }
    };
  app.post(
    "/mcp/oauth/approve",
    express.json({ limit: "16kb" }),
    consent((body) => provider.approve(body.request, body.idToken)),
  );
  app.post(
    "/mcp/oauth/deny",
    express.json({ limit: "16kb" }),
    consent((body) => provider.deny(body.request)),
  );

  const bearer = requireBearerAuth({
    verifier: provider,
    resourceMetadataUrl: urls.resourceMetadata,
    expectedResource: provider.resource,
  });
  app.post(
    "/mcp",
    cors({ exposedHeaders: ["WWW-Authenticate"] }),
    bearer,
    express.json({ limit: "1mb" }),
    async (req, res) => {
      const auth = (req as Request & { auth?: AuthInfo }).auth as AuthInfo;
      const server = createMcpServer(auth, context);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
      try {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error("mcp request", error);
        if (!res.headersSent) {
          res
            .status(500)
            .json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
        }
      }
    },
  );
  app.options("/mcp", cors({ exposedHeaders: ["WWW-Authenticate"] }));
  app.all("/mcp", (_req, res) => {
    res.status(405).set("Allow", "POST").json(JSON_RPC_METHOD_NOT_ALLOWED);
  });

  app.use((_req, res) => {
    res
      .status(404)
      .type("html")
      .send(
        renderMessagePage("Page introuvable", "Cette adresse ne mène à rien sur le serveur MCP."),
      );
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("mcp", error);
    if (!res.headersSent)
      res.status(500).json(new ServerError("Internal Server Error").toResponseObject());
  });

  return app;
}
