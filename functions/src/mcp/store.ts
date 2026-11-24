/**
 * Where the MCP server keeps its sign-in state: the registered clients, the
 * consent requests waiting for the owner, the one-time authorization codes,
 * and the tokens. Codes and tokens are stored under the SHA-256 of their
 * value, never the value itself: reading the collection gives nothing that
 * opens the server.
 *
 * Firestore in production; an in-memory map in the tests. These collections
 * are only touched by the Admin SDK: firestore.rules opens nothing to
 * clients, and its default refusal covers them.
 */
import type { Firestore } from "firebase-admin/firestore";

export type McpCollection = "mcpClients" | "mcpAuthRequests" | "mcpCodes" | "mcpTokens";

export interface McpStore {
  get<T extends object>(collection: McpCollection, id: string): Promise<T | undefined>;
  set(collection: McpCollection, id: string, value: object): Promise<void>;
  /** Reads and deletes in one step: a one-time value can only be taken once. */
  take<T extends object>(collection: McpCollection, id: string): Promise<T | undefined>;
  delete(collection: McpCollection, id: string): Promise<void>;
}

/** Firestore refuses `undefined` fields; an object from JSON has none. */
function plain(value: object): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

export function memoryStore(): McpStore {
  const data = new Map<string, Record<string, unknown>>();
  const key = (collection: McpCollection, id: string) => `${collection}/${id}`;
  return {
    async get<T extends object>(collection: McpCollection, id: string) {
      const value = data.get(key(collection, id));
      return value ? (structuredClone(value) as T) : undefined;
    },
    async set(collection, id, value) {
      data.set(key(collection, id), plain(value));
    },
    async take<T extends object>(collection: McpCollection, id: string) {
      const value = data.get(key(collection, id));
      data.delete(key(collection, id));
      return value ? (value as T) : undefined;
    },
    async delete(collection, id) {
      data.delete(key(collection, id));
    },
  };
}

export function firestoreStore(db: Firestore): McpStore {
  const ref = (collection: McpCollection, id: string) => db.collection(collection).doc(id);
  return {
    async get<T extends object>(collection: McpCollection, id: string) {
      const snap = await ref(collection, id).get();
      return snap.exists ? (snap.data() as T) : undefined;
    },
    async set(collection, id, value) {
      const doc = plain(value);
      // A TTL policy on `expireAt` (optional, docs/mcp.md) lets Firestore
      // sweep what has expired; the server checks `expiresAt` either way.
      if (typeof doc.expiresAt === "number") doc.expireAt = new Date(doc.expiresAt);
      await ref(collection, id).set(doc);
    },
    async take<T extends object>(collection: McpCollection, id: string) {
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref(collection, id));
        if (!snap.exists) return undefined;
        tx.delete(snap.ref);
        return snap.data() as T;
      });
    },
    async delete(collection, id) {
      await ref(collection, id).delete();
    },
  };
}
