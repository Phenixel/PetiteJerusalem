import { describe, expect, it } from "vitest";
import { isIgnoredException } from "../config/ignoredExceptions";

/**
 * Filtre du bruit connu de l'Error tracking. Les messages testés sont ceux
 * réellement observés dans PostHog (WebKit, Chromium et Firebase, pas notre
 * rédaction).
 */

const IDB_LOST =
  "UnknownError: Connection to Indexed Database server lost. Refresh the page to try again";
const IDB_CLOSING =
  "InvalidStateError: Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing.";
const IDB_NO_TRANSACTION =
  "UnknownError: Attempt to get a record from database without an in-progress transaction";
const FIRESTORE_ABORT = "AbortError: signal is aborted without reason";
const RESIZE_UNDELIVERED = "ResizeObserver loop completed with undelivered notifications.";

describe("isIgnoredException", () => {
  it("écarte la perte de connexion IndexedDB (WebKit, polling Firebase Auth)", () => {
    expect(isIgnoredException([IDB_LOST])).toBe(true);
    expect(isIgnoredException([IDB_CLOSING])).toBe(true);
  });

  it("écarte la transaction que WebKit a tuée sous une page suspendue", () => {
    expect(isIgnoredException([IDB_NO_TRANSACTION])).toBe(true);
    expect(
      isIgnoredException([
        "UnknownError: Attempt to iterate a cursor without an in-progress transaction",
      ]),
    ).toBe(true);
  });

  it("écarte le flux que Firestore interrompt en se démontant", () => {
    expect(isIgnoredException([FIRESTORE_ABORT])).toBe(true);
    expect(isIgnoredException([`${FIRESTORE_ABORT}.`])).toBe(true);
    // Un abandon qui porte autre chose n'est pas ce démontage.
    expect(isIgnoredException([`${FIRESTORE_ABORT}, twice`])).toBe(false);
  });

  it("garde visible la boucle de ResizeObserver, qui se corrige dans l'app", () => {
    expect(isIgnoredException([RESIZE_UNDELIVERED])).toBe(false);
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
    expect(isIgnoredException([IDB_NO_TRANSACTION, "TypeError: nope"])).toBe(false);
  });

  it("laisse passer un événement sans message (rien pour décider)", () => {
    expect(isIgnoredException([])).toBe(false);
    expect(isIgnoredException([undefined])).toBe(false);
  });
});
