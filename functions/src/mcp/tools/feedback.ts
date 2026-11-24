/**
 * The user messages (« Nous écrire », docs/feedback.md), read only, without
 * what identifies the people who wrote (feedbackView.ts).
 */
import { z } from "zod";
import { KINDS, STATUSES } from "../../support";
import {
  feedbackFilter,
  isThreadId,
  LIST_LIMIT_DEFAULT,
  LIST_LIMIT_MAX,
  selectFeedback,
  toFeedbackDetail,
} from "../feedbackView";
import { defineTool, ToolInputError } from "./types";

/** At most this many threads are read per call before filtering. */
export const SCAN_MAX = 500;

const kinds = Object.keys(KINDS) as [keyof typeof KINDS, ...(keyof typeof KINDS)[]];

export const listFeedback = defineTool({
  name: "list_feedback",
  title: "List user messages",
  description:
    "Lists the messages users sent from the Petite Jérusalem app or site (« Nous écrire »: ideas, bugs, " +
    "errors in a text, other), most recently active first. Each entry gives the thread id, kind, status, " +
    "platform, app version, the page it was sent from, dates and the start of the first message. " +
    "Contact details and account identities are never included. Use get_feedback for a whole thread.",
  scope: "support:read",
  readOnly: true,
  input: {
    status: z
      .enum(["open", "all", ...STATUSES])
      .optional()
      .describe(
        "open (default) = new + in_progress; new = not yet handled; in_progress; answered = the team replied; done; all.",
      ),
    kind: z
      .enum(kinds)
      .optional()
      .describe("idea, bug, error (in a text, a time, a translation) or other."),
    since: z
      .string()
      .optional()
      .describe(
        "ISO 8601 date or date-time: only threads active since then (new message or status change).",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(LIST_LIMIT_MAX)
      .optional()
      .describe(
        `How many threads to return (default ${LIST_LIMIT_DEFAULT}, at most ${LIST_LIMIT_MAX}).`,
      ),
  },
  async run(args, { support }) {
    if (args.since && !Number.isFinite(Date.parse(args.since))) {
      throw new ToolInputError(`"since" is not a date: ${args.since}`);
    }
    const filter = feedbackFilter(args);
    const { rows, truncated } = await support.recent({ since: filter.since, scanMax: SCAN_MAX });
    const threads = selectFeedback(rows, filter);
    return {
      count: threads.length,
      // Only the most recent SCAN_MAX threads were looked at: older matches
      // may exist. Narrow with `since` to reach them.
      olderNotScanned: truncated,
      threads,
    };
  },
});

export const getFeedback = defineTool({
  name: "get_feedback",
  title: "Read a user message thread",
  description:
    "Reads one thread of user messages in full: every message from the person and the team's replies, " +
    "the team's private note, where it was sent from (platform, version, page) and its status. Says " +
    "whether the person was signed in or left a contact, without giving either.",
  scope: "support:read",
  readOnly: true,
  input: {
    id: z.string().describe("The thread id, as list_feedback returns it."),
  },
  async run({ id }, { support }) {
    if (!isThreadId(id)) throw new ToolInputError(`Not a thread id: ${id}`);
    const row = await support.get(id);
    if (!row) throw new ToolInputError(`No thread with id ${id}.`);
    return toFeedbackDetail(row);
  },
});
