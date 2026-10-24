import { describe, expect, it } from "vitest";
import { isIgnoredException } from "../config/ignoredExceptions";

/**
 * The filter for the known noise of Error tracking. The messages tested here
 * are the ones actually observed in PostHog (WebKit, Firebase and the browser,
 * not our own wording).
 */

const IDB_LOST =
  "UnknownError: Connection to Indexed Database server lost. Refresh the page to try again";
const IDB_CLOSING =
  "InvalidStateError: Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing.";
const IDB_NO_TRANSACTION =
  "UnknownError: Attempt to get a record from database without an in-progress transaction";

describe("isIgnoredException", () => {
  it("drops the loss of the IndexedDB connection (WebKit, Firebase Auth polling)", () => {
    expect(isIgnoredException([IDB_LOST])).toBe(true);
    expect(isIgnoredException([IDB_CLOSING])).toBe(true);
    expect(isIgnoredException([IDB_NO_TRANSACTION])).toBe(true);
  });

  it("drops the resize notifications the browser skipped for a frame", () => {
    expect(isIgnoredException(["ResizeObserver loop limit exceeded"])).toBe(true);
    // A real error quoting the message must stay visible.
    expect(isIgnoredException(["TypeError: ResizeObserver loop limit exceeded reading x"])).toBe(
      false,
    );
  });

  it("drops the stream Firestore aborts when it tears its channel down", () => {
    expect(isIgnoredException(["AbortError: signal is aborted without reason"])).toBe(true);
  });

  it("drops the opaque 'Script error.' of injected cross-origin scripts", () => {
    expect(isIgnoredException(["Script error."])).toBe(true);
    expect(isIgnoredException(["Script error"])).toBe(true);
    // A real error quoting the message must stay visible.
    expect(isIgnoredException(["Error: loading chunk failed after Script error."])).toBe(false);
  });

  it("lets real errors through", () => {
    expect(isIgnoredException(["TypeError: undefined is not a function"])).toBe(false);
    expect(isIgnoredException(["Firebase: Error (auth/network-request-failed)."])).toBe(false);
  });

  it("lets a real error wrapping a known message through", () => {
    expect(isIgnoredException(["TypeError: undefined is not a function", IDB_LOST])).toBe(false);
  });

  it("lets an event with no message through (nothing to decide on)", () => {
    expect(isIgnoredException([])).toBe(false);
    expect(isIgnoredException([undefined])).toBe(false);
  });
});
