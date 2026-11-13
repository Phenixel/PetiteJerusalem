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

  it("does not answer a missing asset, font or text with the app shell", () => {
    // The catch-all rewrite used to cover these folders: a chunk gone after a
    // release, or a text asked before it was published, came back as 200
    // text/html, with the long cache of its folder (a year for /assets).
    const shell = hosting.rewrites.filter((r) => r.destination === "/app.html");
    expect(shell.map((r) => r.source)).toEqual(["!/@(assets|fonts|texts)/**"]);
    // Each excluded folder is one the build fills and a header block caches.
    for (const folder of ["assets", "fonts", "texts"]) {
      expect(hosting.headers.some((h) => h.source === `/${folder}/**`)).toBe(true);
    }
  });

  it("sends the security headers on every response", () => {
    const everywhere = hosting.headers.find((h) => h.source === "**")?.headers ?? [];
    const value = (key: string) => everywhere.find((h) => h.key === key)?.value ?? "";
    expect(value("X-Content-Type-Options")).toBe("nosniff");
    expect(value("Strict-Transport-Security")).toContain("max-age=31536000");
    // Sign-in by popup (Google, Apple) needs the opener kept for popups.
    expect(value("Cross-Origin-Opener-Policy")).toBe("same-origin-allow-popups");
    // The part of a content security policy that needs no inventory of the
    // scripts: no <base> elsewhere, no plugin, no framing by another site.
    const csp = value("Content-Security-Policy");
    for (const directive of ["base-uri 'self'", "object-src 'none'", "frame-ancestors 'self'"]) {
      expect(csp).toContain(directive);
    }
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
