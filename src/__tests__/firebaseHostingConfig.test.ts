// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The shape of the hosting configuration (firebase.json). A header block
 * slipped into `redirects` passes JSON parsing and every local check, then
 * fails only at deploy time ("Must supply a location with redirect
 * configuration"): this test fails first.
 */

interface Entry {
  source?: string;
  destination?: string;
  type?: number;
  headers?: { key: string; value: string }[];
  function?: string;
}

const hosting = JSON.parse(readFileSync("firebase.json", "utf8")).hosting as {
  headers: Entry[];
  redirects: Entry[];
  rewrites: Entry[];
};

describe("the hosting configuration", () => {
  it("gives every redirect a source, a destination and a status", () => {
    const wrong = hosting.redirects.filter(
      (r) => !r.source || !r.destination || ![301, 302].includes(r.type ?? 0) || r.headers,
    );
    expect(wrong).toEqual([]);
  });

  it("gives every header block a source and headers", () => {
    const wrong = hosting.headers.filter(
      (h) => !h.source || !h.headers?.length || h.destination !== undefined,
    );
    expect(wrong).toEqual([]);
  });

  it("states the social preview's cache policy on its rewritten routes", () => {
    const rewritten = hosting.rewrites.filter((r) => r.function === "socialPreview");
    expect(rewritten.length).toBeGreaterThan(0);
    const missing = rewritten
      .filter((route) => {
        // The last matching block wins: these come after the catch-all no-cache.
        const block = [...hosting.headers].reverse().find((h) => h.source === route.source);
        const cache = block?.headers?.find((h) => h.key === "Cache-Control")?.value ?? "";
        return !cache.includes("s-maxage=600");
      })
      .map((route) => route.source);
    expect(missing).toEqual([]);
  });
});
