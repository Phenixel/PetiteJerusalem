import { test as base, expect, readDoc, seedDoc, uniqueId } from "./firebase";
import {
  PROJECT_ID,
  FIRESTORE_PORT,
  toFirestoreFields,
} from "../../scripts/lib/firebase-emulator.mjs";

/**
 * Foundation of the security rules suite (e2e/firebase/rules.spec.ts).
 *
 * The Firestore emulator is asked over REST, as a client talking to Firestore
 * without the app would: on behalf of a guest (no token), of an account, or
 * of the admin. Each helper returns the HTTP status, `ALLOWED` when the rules
 * accept the request and `DENIED` when they refuse it. Any other status (a
 * malformed request, a failed precondition) makes the assertion fail, which
 * is the point: a test must not read a broken request as a refusal.
 *
 * The data a test starts from is set with `seedDoc`, whose "owner" token
 * bypasses the rules.
 */

export const test = base.extend({
  // The JavaScript error net of the foundation opens a page for every test.
  // These tests have no page: the net is replaced by an empty one, and no
  // browser starts.
  pageErrors: async ({}, use) => {
    await use([]);
  },
});

export { expect, readDoc, seedDoc, uniqueId };

/** The rules accepted the request. */
export const ALLOWED = 200;
/** The rules refused the request. */
export const DENIED = 403;

/** The only address the rules take for the admin (isAdmin in firestore.rules). */
export const ADMIN_EMAIL = "admin@phenixel.fr";

export type Identity = { uid: string; email?: string; emailVerified?: boolean };

/** Who sends the request: `null` for a guest, a uid, or a full identity. */
export type Caller = Identity | string | null;

export const GUEST: Caller = null;

/** The uid of an account that exists nowhere else: the rules only read the token. */
export const account = (label = "account"): string => `${label}-${uniqueId()}`;

/** The admin as the rules know it: its address, verified. */
export const admin = (): Identity => ({
  uid: `admin-${uniqueId()}`,
  email: ADMIN_EMAIL,
  emailVerified: true,
});

/**
 * The admin's address on an account nobody verified: what anyone gets by
 * signing up with email and password under that address.
 */
export const unverifiedAdmin = (): Identity => ({
  uid: `unverified-${uniqueId()}`,
  email: ADMIN_EMAIL,
  emailVerified: false,
});

const DOCUMENTS = `projects/${PROJECT_ID}/databases/(default)/documents`;
const ROOT = `http://localhost:${FIRESTORE_PORT}/v1/${DOCUMENTS}`;

/**
 * An unsigned token, which the Firestore emulator takes for the one of a
 * signed-in account. With an email, it carries the `email` and
 * `email_verified` claims the rules read to recognise the admin.
 */
export function fakeIdToken(identity: Identity): string {
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const { uid, email } = identity;
  return `${b64({ alg: "none", kid: "fakekid", typ: "JWT" })}.${b64({
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    aud: PROJECT_ID,
    iat: now,
    exp: now + 3600,
    auth_time: now,
    sub: uid,
    user_id: uid,
    ...(email ? { email, email_verified: identity.emailVerified === true } : {}),
    firebase: { sign_in_provider: "password", identities: email ? { email: [email] } : {} },
  })}.`;
}

function headers(caller: Caller): Record<string, string> {
  if (caller === null) return { "Content-Type": "application/json" };
  const identity = typeof caller === "string" ? { uid: caller } : caller;
  return {
    Authorization: `Bearer ${fakeIdToken(identity)}`,
    "Content-Type": "application/json",
  };
}

export type Fields = Record<string, unknown>;

export type WriteOptions = {
  /**
   * Fields set to the time of the server, as `serverTimestamp()` does in the
   * app: the rules read them equal to `request.time`.
   */
  serverTime?: string[];
};

async function commit(caller: Caller, write: object): Promise<number> {
  const res = await fetch(`${ROOT}:commit`, {
    method: "POST",
    headers: headers(caller),
    body: JSON.stringify({ writes: [write] }),
  });
  return res.status;
}

const transforms = (options: WriteOptions) =>
  options.serverTime?.length
    ? {
        updateTransforms: options.serverTime.map((fieldPath) => ({
          fieldPath,
          setToServerValue: "REQUEST_TIME",
        })),
      }
    : {};

/** Creates the document at `path` (`collection/id`, or deeper). */
export function create(
  caller: Caller,
  path: string,
  fields: Fields,
  options: WriteOptions = {},
): Promise<number> {
  return commit(caller, {
    update: { name: `${DOCUMENTS}/${path}`, fields: toFirestoreFields(fields) },
    ...transforms(options),
    currentDocument: { exists: false },
  });
}

/**
 * Updates the fields named in `mask` on an existing document, and nothing
 * else. A field named in `mask` but absent from `fields` is deleted.
 */
export function update(
  caller: Caller,
  path: string,
  fields: Fields,
  mask: string[],
  options: WriteOptions = {},
): Promise<number> {
  return commit(caller, {
    update: { name: `${DOCUMENTS}/${path}`, fields: toFirestoreFields(fields) },
    updateMask: { fieldPaths: mask },
    ...transforms(options),
    currentDocument: { exists: true },
  });
}

/** Deletes the document at `path`. */
export function remove(caller: Caller, path: string): Promise<number> {
  return commit(caller, { delete: `${DOCUMENTS}/${path}` });
}

/** Reads one document (`get` in the rules). */
export async function get(caller: Caller, path: string): Promise<number> {
  const res = await fetch(`${ROOT}/${path}`, { headers: headers(caller) });
  return res.status;
}

/** Lists a whole collection, with no filter (`list` in the rules). */
export async function list(caller: Caller, collectionPath: string): Promise<number> {
  const res = await fetch(`${ROOT}/${collectionPath}`, { headers: headers(caller) });
  return res.status;
}

export type QueryOptions = {
  /** Keeps the documents whose `field` equals `value`. */
  where?: { field: string; value: unknown };
  /** The document under which the collection lives, for a subcollection. */
  parent?: string;
  /** A collection group query: every collection of that name, wherever it is. */
  allDescendants?: boolean;
};

/** Runs a query on a collection (`list` in the rules, with its filter). */
export async function query(
  caller: Caller,
  collectionId: string,
  options: QueryOptions = {},
): Promise<number> {
  const { where, parent, allDescendants } = options;
  const res = await fetch(`${ROOT}${parent ? `/${parent}` : ""}:runQuery`, {
    method: "POST",
    headers: headers(caller),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId, ...(allDescendants ? { allDescendants: true } : {}) }],
        ...(where
          ? {
              where: {
                fieldFilter: {
                  field: { fieldPath: where.field },
                  op: "EQUAL",
                  value: toFirestoreFields({ value: where.value }).value,
                },
              },
            }
          : {}),
      },
    }),
  });
  if (!res.ok) return res.status;
  // A query answers as a stream: a refusal can come inside a 200.
  const rows = (await res.json()) as { error?: { code?: number } }[];
  const failed = Array.isArray(rows) ? rows.find((row) => row.error) : undefined;
  return failed?.error?.code ?? res.status;
}
