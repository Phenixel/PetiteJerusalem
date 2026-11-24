/**
 * The MCP tools' only doors into the user messages, `support/{id}`: reading
 * (`SupportSource`), and adding a team reply (`SupportReplies`), nothing
 * else. The tools never see the Firestore handle, so a tool cannot reach
 * another collection, or write anything else, without a new, explicit door
 * like these (and a new scope, scopes.ts).
 */
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { isThreadId, type SupportRow } from "./feedbackView";
import { planTeamReply, type TeamReplyPlan } from "./teamReply";

export interface SupportSource {
  /** Threads active since `since` (all of them without), most recent first. */
  recent(options: {
    since: Date | null;
    scanMax: number;
  }): Promise<{ rows: SupportRow[]; truncated: boolean }>;
  get(id: string): Promise<SupportRow | null>;
}

export interface SupportReplies {
  /**
   * Adds the team's reply to one thread, as the back office does. Throws
   * ReplyRefused when it may not go (teamReply.ts); null when there is no
   * such thread.
   */
  reply(id: string, text: string, close: boolean): Promise<TeamReplyPlan | null>;
}

const COLLECTION = "support";

export function firestoreSupportSource(db: Firestore): SupportSource {
  return {
    async recent({ since, scanMax }) {
      let query = db.collection(COLLECTION).orderBy("updatedAt", "desc");
      if (since) query = query.where("updatedAt", ">=", since);
      const snap = await query.limit(scanMax + 1).get();
      const rows = snap.docs.slice(0, scanMax).map((doc) => ({ id: doc.id, data: doc.data() }));
      return { rows, truncated: snap.size > scanMax };
    },
    async get(id) {
      if (!isThreadId(id)) return null;
      const snap = await db.collection(COLLECTION).doc(id).get();
      return snap.exists ? { id: snap.id, data: snap.data() ?? {} } : null;
    },
  };
}

export function firestoreSupportReplies(db: Firestore): SupportReplies {
  return {
    async reply(id, text, close) {
      if (!isThreadId(id)) return null;
      const ref = db.collection(COLLECTION).doc(id);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return null;
        const plan = planTeamReply(snap.data() ?? {}, text, close);
        // The same fields as replySupportThread (src/services/adminService.ts).
        tx.update(ref, {
          messages: FieldValue.arrayUnion({ from: "team", text: plan.text, at: Timestamp.now() }),
          status: plan.status,
          lastFrom: "team",
          unreadByUser: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return plan;
      });
    },
  };
}

/** The same, over a fixed list it changes in place: the tests' door. */
export function memorySupportReplies(rows: SupportRow[], now = () => new Date()): SupportReplies {
  return {
    async reply(id, text, close) {
      const row = rows.find((candidate) => candidate.id === id);
      if (!row) return null;
      const plan = planTeamReply(row.data, text, close);
      const at = now();
      const messages = Array.isArray(row.data.messages) ? row.data.messages : [];
      row.data = {
        ...row.data,
        messages: [...messages, { from: "team", text: plan.text, at }],
        status: plan.status,
        lastFrom: "team",
        unreadByUser: true,
        updatedAt: at,
      };
      return plan;
    },
  };
}

/** The same, over a fixed list: the tests' source. */
export function memorySupportSource(rows: SupportRow[]): SupportSource {
  const updated = (row: SupportRow) => {
    const value = row.data.updatedAt as { getTime?: () => number } | undefined;
    return typeof value?.getTime === "function" ? value.getTime() : 0;
  };
  return {
    async recent({ since, scanMax }) {
      const matching = rows
        .filter((row) => !since || updated(row) >= since.getTime())
        .sort((a, b) => updated(b) - updated(a));
      return { rows: matching.slice(0, scanMax), truncated: matching.length > scanMax };
    },
    async get(id) {
      return rows.find((row) => row.id === id) ?? null;
    },
  };
}
