/**
 * The MCP tools' only door into the user messages: `support/{id}`, read only.
 * The tools never see the Firestore handle, so a tool cannot reach another
 * collection without a new, explicit source like this one (and a new scope,
 * scopes.ts).
 */
import type { Firestore } from "firebase-admin/firestore";
import { isThreadId, type SupportRow } from "./feedbackView";

export interface SupportSource {
  /** Threads active since `since` (all of them without), most recent first. */
  recent(options: {
    since: Date | null;
    scanMax: number;
  }): Promise<{ rows: SupportRow[]; truncated: boolean }>;
  get(id: string): Promise<SupportRow | null>;
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
