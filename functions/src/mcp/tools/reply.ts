/**
 * Answering a person on their « Nous écrire » thread, in the team's name
 * (scope support:reply, which the owner ticks apart on the consent page).
 * One text, one thread, per call: no sending in bulk.
 */
import { z } from "zod";
import { TEXT_MAX } from "../../support";
import { isThreadId } from "../feedbackView";
import { ReplyRefused } from "../teamReply";
import { defineTool, ToolInputError } from "./types";

export const replyToFeedback = defineTool({
  name: "reply_to_feedback",
  title: "Reply to a user message thread",
  description:
    "Sends the team's reply to ONE person, on their thread: they read it in the app or on the site " +
    "(« Nous écrire », marked as a new reply) and get a push notification when their device allows it. " +
    "It cannot be taken back. Only send a text the owner approved word for word for this thread, in the " +
    "language the person wrote in (get_feedback gives it as `locale`). The thread becomes `answered`, or " +
    "`done` with close: true. Refused when the person left no account or device to read it, or when the " +
    "same text is already the team's last message.",
  scope: "support:reply",
  readOnly: false,
  openWorld: true,
  input: {
    id: z.string().describe("The thread id, as list_feedback or get_feedback returns it."),
    text: z
      .string()
      .min(1)
      .max(TEXT_MAX)
      .describe(`The reply exactly as the owner approved it (${TEXT_MAX} characters at most).`),
    close: z
      .boolean()
      .optional()
      .describe("true: the thread becomes `done` instead of `answered`."),
  },
  async run({ id, text, close }, { replies }) {
    if (!isThreadId(id)) throw new ToolInputError(`Not a thread id: ${id}`);
    try {
      const plan = await replies.reply(id, text, close === true);
      if (!plan) throw new ToolInputError(`No thread with id ${id}.`);
      return {
        id,
        sent: true,
        status: plan.status,
        shownIn: "The person's « Nous écrire » thread, in the app or on the site, as a new reply.",
        notification: plan.mayNotify
          ? "Sent to the person's devices, where they allowed notifications."
          : "None: no device of theirs is known. The reply waits in the app.",
      };
    } catch (error) {
      if (error instanceof ReplyRefused) throw new ToolInputError(error.message);
      throw error;
    }
  },
});
