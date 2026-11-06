import { describe, expect, it } from "vitest";
import { isIgnoredException } from "../config/ignoredExceptions";

/**
 * Filtre du bruit connu de l'Error tracking. Les messages testés sont ceux
 * réellement observés dans PostHog (WebKit et Firebase, pas notre rédaction).
 */

const IDB_LOST =
  "UnknownError: Connection to Indexed Database server lost. Refresh the page to try again";
const IDB_CLOSING =
  "InvalidStateError: Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing.";
const IDB_NO_TRANSACTION =
  "UnknownError: Attempt to get a record from database without an in-progress transaction";
const FIRESTORE_ABORT = "AbortError: signal is aborted without reason";

describe("isIgnoredException", () => {
  it("écarte la perte de connexion IndexedDB (WebKit, polling Firebase Auth)", () => {
    expect(isIgnoredException([IDB_LOST])).toBe(true);
    expect(isIgnoredException([IDB_CLOSING])).toBe(true);
  });

  it("drops the read left without a transaction by the same WebKit suspension", () => {
    expect(isIgnoredException([IDB_NO_TRANSACTION])).toBe(true);
  });

  it("drops the stream Firestore aborts when a listener goes away", () => {
    expect(isIgnoredException([FIRESTORE_ABORT])).toBe(true);
    // A real abort of ours, with its reason, stays visible.
    expect(isIgnoredException(["AbortError: signal is aborted without reason, twice"])).toBe(false);
  });

  it("drops the resize notifications the browser could not deliver in one frame", () => {
    expect(isIgnoredException(["ResizeObserver loop limit exceeded"])).toBe(true);
    expect(
      isIgnoredException(["ResizeObserver loop completed with undelivered notifications."]),
    ).toBe(true);
    // An error of ours that names a ResizeObserver stays visible.
    expect(isIgnoredException(["TypeError: ResizeObserver loop guard is not a function"])).toBe(
      false,
    );
  });

  it("écarte la « Script error. » opaque des scripts injectés cross-origin", () => {
    expect(isIgnoredException(["Script error."])).toBe(true);
    expect(isIgnoredException(["Script error"])).toBe(true);
    // Une vraie erreur qui cite le message doit rester visible.
    expect(isIgnoredException(["Error: loading chunk failed after Script error."])).toBe(false);
  });

  it("laisse passer les vraies erreurs", () => {
    expect(isIgnoredException(["TypeError: undefined is not a function"])).toBe(false);
    expect(isIgnoredException(["Firebase: Error (auth/network-request-failed)."])).toBe(false);
  });

  it("laisse passer une vraie erreur qui enveloppe un message connu", () => {
    expect(isIgnoredException(["TypeError: undefined is not a function", IDB_LOST])).toBe(false);
  });

  it("laisse passer un événement sans message (rien pour décider)", () => {
    expect(isIgnoredException([])).toBe(false);
    expect(isIgnoredException([undefined])).toBe(false);
  });
});
