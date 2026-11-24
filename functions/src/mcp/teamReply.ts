/**
 * A reply from the team, sent by an assistant through the MCP server
 * (`reply_to_feedback`, scope `support:reply`). It takes the same path as the
 * back office (`replySupportThread` in src/services/adminService.ts) and the
 * command line (`support:repondre`): the message joins the thread, the thread
 * becomes « répondu » (« terminé » when closed), the person sees « nouvelle
 * réponse », and the Cloud Function onSupportThreadWritten notifies their
 * devices. This module decides whether the reply may go and what it writes.
 *
 * Pure module (no firebase-functions, no MCP SDK): the site's unit tests read
 * it (src/__tests__/mcpServer.test.ts).
 */
import { TEXT_MAX, type SupportStatus } from "../support";

/** Why a reply was not sent, in words for the assistant. */
export class ReplyRefused extends Error {}

export interface TeamReplyPlan {
  text: string;
  status: Extract<SupportStatus, "answered" | "done">;
  /**
   * Whether the person may get a notification: their device left a push
   * token, or they wrote signed in (the account's devices are looked up by
   * onSupportThreadWritten). Either way the reply waits in the app.
   */
  mayNotify: boolean;
}

function lastTeamText(data: Record<string, unknown>): string | null {
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const last = [...messages]
    .reverse()
    .find((m) => !!m && typeof m === "object" && (m as { from?: unknown }).from === "team") as
    | { text?: unknown }
    | undefined;
  return typeof last?.text === "string" ? last.text.trim() : null;
}

export function planTeamReply(
  data: Record<string, unknown>,
  rawText: unknown,
  close: boolean,
): TeamReplyPlan {
  const text = typeof rawText === "string" ? rawText.trim() : "";
  if (!text) throw new ReplyRefused("The reply is empty.");
  if (text.length > TEXT_MAX) {
    throw new ReplyRefused(`The reply is ${text.length} characters long, ${TEXT_MAX} at most.`);
  }
  const uid = typeof data.uid === "string" ? data.uid : "";
  const guestKey = typeof data.guestKeyHash === "string" ? data.guestKeyHash : "";
  if (!uid && !guestKey) {
    throw new ReplyRefused(
      "This person wrote without an account or a device key (an older app, or the site signed out): " +
        "a reply here would show nowhere. The team can only answer them by email, from the back office.",
    );
  }
  if (lastTeamText(data) === text) {
    throw new ReplyRefused("This exact reply is already the team's last message on this thread.");
  }
  const tokens = Array.isArray(data.pushTokens) ? data.pushTokens.filter((t) => !!t) : [];
  return { text, status: close ? "done" : "answered", mayNotify: tokens.length > 0 || !!uid };
}
