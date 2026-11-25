/**
 * The pure parts of the MCP server (functions/src/mcp, docs/mcp.md): what a
 * connected assistant gets to read, which scopes it is granted, who may
 * connect it, and the consent page. The server itself, over HTTP, is tested
 * by the functions' own suite (functions/test/mcp.test.ts).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  feedbackFilter,
  isThreadId,
  LIST_LIMIT_DEFAULT,
  LIST_LIMIT_MAX,
  selectFeedback,
  toFeedbackDetail,
  toFeedbackSummary,
  type SupportRow,
} from "../../functions/src/mcp/feedbackView";
import {
  ALL_SCOPES,
  approvedScopes,
  narrowScopes,
  offeredScopes,
  SCOPES,
} from "../../functions/src/mcp/scopes";
import { planTeamReply, ReplyRefused } from "../../functions/src/mcp/teamReply";
import { isOwner, OWNER_EMAILS, ownerVerdict } from "../../functions/src/mcp/owner";
import { escapeHtml, renderConsentPage } from "../../functions/src/mcp/consentPage";

const row = (id: string, data: Record<string, unknown>): SupportRow => ({ id, data });

const withContact = row("privateThread", {
  kind: "bug",
  contact: "+33 6 12 34 56 78",
  uid: "uid-123",
  accountEmail: "person@example.com",
  accountName: "Prénom Nom",
  guestKeyHash: "hash-of-device-key",
  pushTokens: ["token-abc"],
  status: "in_progress",
  note: "seen on Android 15",
  messages: [
    {
      from: "user",
      text: "  It   crashes\nwhen I open the Omer. ",
      at: new Date("2026-11-10T08:00:00Z"),
    },
  ],
  createdAt: new Date("2026-11-10T08:00:00Z"),
  updatedAt: new Date("2026-11-11T08:00:00Z"),
});

describe("what the assistant reads of a thread", () => {
  it("never carries what identifies or reaches the person", () => {
    const text = JSON.stringify([toFeedbackSummary(withContact), toFeedbackDetail(withContact)]);
    for (const secret of [
      "+33 6",
      "uid-123",
      "person@example.com",
      "Prénom Nom",
      "hash-of-device-key",
      "token-abc",
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  it("says only whether the team can answer them", () => {
    expect(toFeedbackDetail(withContact)).toMatchObject({
      signedIn: true,
      hasContact: true,
      teamNote: "seen on Android 15",
    });
    expect(toFeedbackDetail(row("anon", { messages: [] }))).toMatchObject({
      signedIn: false,
      hasContact: false,
    });
  });

  it("keeps a short, flat excerpt of the first message", () => {
    expect(toFeedbackSummary(withContact).excerpt).toBe("It crashes when I open the Omer.");
    const long = toFeedbackSummary(
      row("long", { messages: [{ from: "user", text: "a".repeat(1000) }] }),
    ).excerpt;
    expect(long.length).toBeLessThanOrEqual(280);
    expect(long.endsWith("…")).toBe(true);
  });

  it("gives dates as ISO strings and fills unknown values with safe defaults", () => {
    const summary = toFeedbackSummary(row("odd", { kind: "nonsense", status: 12, platform: "tv" }));
    expect(summary).toMatchObject({
      kind: "other",
      status: "new",
      platform: "web",
      support: "web",
      createdAt: null,
    });
    expect(toFeedbackSummary(withContact).updatedAt).toBe("2026-11-11T08:00:00.000Z");
  });
});

describe("listing threads", () => {
  const rows = [
    withContact,
    row("newIdea", { kind: "idea", status: "new", updatedAt: new Date("2026-11-20T08:00:00Z") }),
    row("doneBug", { kind: "bug", status: "done", updatedAt: new Date("2026-11-21T08:00:00Z") }),
  ];
  const ids = (input: Parameters<typeof feedbackFilter>[0]) =>
    selectFeedback(rows, feedbackFilter(input)).map((summary) => summary.id);

  it("shows what still needs the team by default, latest first", () => {
    expect(ids({})).toEqual(["newIdea", "privateThread"]);
  });

  it("filters by status, kind and date", () => {
    expect(ids({ status: "all" })).toEqual(["doneBug", "newIdea", "privateThread"]);
    expect(ids({ status: "done" })).toEqual(["doneBug"]);
    expect(ids({ status: "all", kind: "bug" })).toEqual(["doneBug", "privateThread"]);
    expect(ids({ status: "all", since: "2026-11-15" })).toEqual(["doneBug", "newIdea"]);
  });

  it("keeps the limit within bounds and ignores what it does not know", () => {
    expect(feedbackFilter({})).toEqual({
      status: "open",
      kind: null,
      since: null,
      limit: LIST_LIMIT_DEFAULT,
    });
    expect(feedbackFilter({ limit: 10_000 }).limit).toBe(LIST_LIMIT_MAX);
    expect(feedbackFilter({ limit: 0 }).limit).toBe(1);
    expect(feedbackFilter({ status: "everything", kind: "spam", since: "soon" })).toMatchObject({
      status: "open",
      kind: null,
      since: null,
    });
    expect(ids({ status: "all", limit: 1 })).toEqual(["doneBug"]);
  });

  it("looks up only ids shaped like the back office's", () => {
    expect(isThreadId("aZ09_-x")).toBe(true);
    for (const id of ["", "../users/x", "a/b", "x".repeat(101), 42])
      expect(isThreadId(id)).toBe(false);
  });
});

describe("scopes", () => {
  it("each has a label the owner reads on the consent page", () => {
    for (const scope of ALL_SCOPES) expect(SCOPES[scope].label.length).toBeGreaterThan(10);
  });

  it("offers the known scopes asked for, or all of them", () => {
    expect(offeredScopes(undefined)).toEqual(ALL_SCOPES);
    expect(offeredScopes(["openid", "offline_access"])).toEqual(ALL_SCOPES);
    expect(offeredScopes(["support:read", "support:read"])).toEqual(["support:read"]);
  });

  it("grants what the owner ticked among what was offered, and never preselects a write", () => {
    expect(approvedScopes(ALL_SCOPES, ["support:reply", "admin:all"])).toEqual(["support:reply"]);
    expect(approvedScopes(["support:read"], ["support:read", "support:reply"])).toEqual([
      "support:read",
    ]);
    expect(approvedScopes(ALL_SCOPES, undefined)).toEqual(["support:read"]);
    expect(SCOPES["support:reply"].preselected).toBe(false);
  });

  it("lets a refresh narrow its scopes, never widen them", () => {
    expect(narrowScopes(["support:read"], undefined)).toEqual(["support:read"]);
    expect(narrowScopes(["support:read"], ["support:write"])).toEqual([]);
    expect(narrowScopes([], ["support:read"])).toEqual([]);
  });
});

describe("a reply from the team", () => {
  const reachable = { uid: "u1", messages: [{ from: "user", text: "Bug" }] };

  it("takes the back office's path: the thread is answered, or done when closed", () => {
    expect(planTeamReply(reachable, "  Fixed, thanks.  ", false)).toEqual({
      text: "Fixed, thanks.",
      status: "answered",
      mayNotify: true,
    });
    expect(planTeamReply({ guestKeyHash: "h" }, "Done", true)).toMatchObject({
      status: "done",
      mayNotify: false,
    });
    expect(planTeamReply({ guestKeyHash: "h", pushTokens: ["t"] }, "Done", true).mayNotify).toBe(
      true,
    );
  });

  it("refuses what would show nowhere, an empty or too long text, and a repeat", () => {
    expect(() => planTeamReply({ contact: "a@b.c" }, "Hello", false)).toThrow(/by email/);
    expect(() => planTeamReply(reachable, "   ", false)).toThrow(ReplyRefused);
    expect(() => planTeamReply(reachable, "x".repeat(2001), false)).toThrow(ReplyRefused);
    const answered = {
      ...reachable,
      messages: [...reachable.messages, { from: "team", text: "Fixed, thanks." }],
    };
    expect(() => planTeamReply(answered, "Fixed, thanks. ", false)).toThrow(/already/);
  });
});

describe("who may connect an assistant", () => {
  it("is the verified owner account only", () => {
    expect(isOwner({ email: "Admin@Phenixel.fr", email_verified: true })).toBe(true);
    expect(isOwner({ email: "admin@phenixel.fr", emailVerified: true })).toBe(true);
    expect(isOwner({ email: "admin@phenixel.fr", email_verified: false })).toBe(false);
    expect(isOwner({ email: "admin@phenixel.fr", emailVerified: true, disabled: true })).toBe(
      false,
    );
    expect(isOwner({ email: "someone@phenixel.fr", email_verified: true })).toBe(false);
    expect(isOwner(null)).toBe(false);
  });

  it("tells the consent page why an account is refused", () => {
    const now = 1_800_000_000;
    const owner = { uid: "u1", email: "Admin@Phenixel.fr", email_verified: true, iat: now - 10 };
    expect(ownerVerdict(owner, now)).toEqual({ uid: "u1" });
    expect(ownerVerdict({ ...owner, email: "someone@gmail.com" }, now)).toEqual({
      refused: expect.stringContaining("Connecté avec someone@gmail.com"),
    });
    expect(ownerVerdict({ ...owner, email: undefined }, now)).toEqual({
      refused: expect.stringContaining("pas d'adresse"),
    });
    expect(ownerVerdict({ ...owner, email_verified: false }, now)).toEqual({
      refused: expect.stringContaining("n'est pas marquée comme vérifiée"),
    });
    expect(ownerVerdict({ ...owner, iat: now - 3600 }, now)).toEqual({
      refused: expect.stringContaining("trop longtemps"),
    });
  });

  it("is the same account the Firestore rules call admin", () => {
    const rules = readFileSync("firestore.rules", "utf8");
    const listed = rules.match(/function isAdmin\(\)[\s\S]*?email in \[([^\]]*)\]/)?.[1] ?? "";
    const emails = [...listed.matchAll(/'([^']+)'/g)].map((match) => match[1]);
    expect(emails).toEqual([...OWNER_EMAILS]);
  });
});

describe("the consent page", () => {
  const page = renderConsentPage({
    requestId: "request_id_0123456789",
    clientName: `<script>alert("x")</script>`,
    redirectHost: "claude.ai",
    scopes: ALL_SCOPES.map((scope) => ({
      scope,
      label: SCOPES[scope].label,
      checked: SCOPES[scope].preselected,
    })),
  });

  it("escapes what the client chose to call itself", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
    expect(page).not.toContain(`<script>alert`);
    expect(page).toContain("&lt;script&gt;");
  });

  it("ticks reading and leaves replying to the owner's own tick", () => {
    expect(page).toContain('value="support:read" checked');
    expect(page).toContain('value="support:reply">');
  });

  it("names where the access goes and what it allows", () => {
    expect(page).toContain("claude.ai");
    expect(page).toContain("Nous écrire");
    expect(page).toContain("request_id_0123456789");
  });

  it("cannot be closed early by its own data", () => {
    const tricky = renderConsentPage({
      requestId: "r",
      clientName: "</script><script>alert(1)</script>",
      redirectHost: "x",
      scopes: [],
    });
    expect(tricky.match(/<\/script>/g)?.length).toBe(page.match(/<\/script>/g)?.length);
  });
});

describe("hosting", () => {
  it("sends the MCP paths to the function, before the app's catch-all", () => {
    const { hosting } = JSON.parse(readFileSync("firebase.json", "utf8"));
    const sources: string[] = hosting.rewrites.map((rewrite: { source: string }) => rewrite.source);
    const catchAll = sources.indexOf("!/@(assets|fonts|texts)/**");
    for (const path of [
      "/mcp",
      "/mcp/**",
      "/.well-known/oauth-protected-resource/**",
      "/.well-known/oauth-authorization-server/**",
    ]) {
      const index = sources.indexOf(path);
      expect({
        path,
        routed: index >= 0 && index < catchAll,
        to: hosting.rewrites[index]?.function,
      }).toEqual({
        path,
        routed: true,
        to: "mcp",
      });
    }
  });
});
