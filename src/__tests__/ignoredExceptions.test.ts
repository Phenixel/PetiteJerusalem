import { describe, expect, it } from "vitest";
import { isIgnoredException } from "../config/ignoredExceptions";

/**
 * The filter for known Error tracking noise. The messages tested here are the
 * ones actually seen in PostHog (WebKit, Chromium and Firebase, not our own
 * wording).
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
  it("drops the lost IndexedDB connection (WebKit, Firebase Auth polling)", () => {
    expect(isIgnoredException([IDB_LOST])).toBe(true);
    expect(isIgnoredException([IDB_CLOSING])).toBe(true);
  });

  it("drops the transaction WebKit killed under a suspended page", () => {
    expect(isIgnoredException([IDB_NO_TRANSACTION])).toBe(true);
    expect(
      isIgnoredException([
        "UnknownError: Attempt to iterate a cursor without an in-progress transaction",
      ]),
    ).toBe(true);
  });

  it("drops the stream Firestore aborts on its own teardown", () => {
    expect(isIgnoredException([FIRESTORE_ABORT])).toBe(true);
    expect(isIgnoredException([`${FIRESTORE_ABORT}.`])).toBe(true);
    // An abort carrying something else is not that teardown.
    expect(isIgnoredException([`${FIRESTORE_ABORT}, twice`])).toBe(false);
  });

  it("keeps the ResizeObserver loop visible: it is fixed in the app", () => {
    expect(isIgnoredException([RESIZE_UNDELIVERED])).toBe(false);
  });

  it("drops the opaque « Script error. » of injected cross-origin scripts", () => {
    expect(isIgnoredException(["Script error."])).toBe(true);
    expect(isIgnoredException(["Script error"])).toBe(true);
    // A real error quoting the message must stay visible.
    expect(isIgnoredException(["Error: loading chunk failed after Script error."])).toBe(false);
  });

  it("lets real errors through", () => {
    expect(isIgnoredException(["TypeError: undefined is not a function"])).toBe(false);
    expect(isIgnoredException(["Firebase: Error (auth/network-request-failed)."])).toBe(false);
  });

  it("lets through a real error that wraps a known message", () => {
    expect(isIgnoredException(["TypeError: undefined is not a function", IDB_LOST])).toBe(false);
    expect(isIgnoredException([IDB_NO_TRANSACTION, "TypeError: nope"])).toBe(false);
  });

  it("lets through an event with no message (nothing to decide on)", () => {
    expect(isIgnoredException([])).toBe(false);
    expect(isIgnoredException([undefined])).toBe(false);
  });
});
