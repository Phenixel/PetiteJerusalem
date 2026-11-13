// @vitest-environment node
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * The chapters of the Talmud (public/texts/talmud-chapters.json) start where
 * the Vilna text starts them. The file used to come from a split proportional
 * to the number of mishnayot, silently used whenever the chapter starts could
 * not be found: every boundary of every tractate was several dafim off
 * (Berakhot 2 read from 7b instead of 13a), in the reader, the chains, the
 * prerendered pages and Mon parcours. See scripts/generate-talmud-chapters.mjs.
 */

interface Range {
  chapter: number;
  startDaf?: string;
  startIdx: number;
  endIdx: number;
}

const chapters = JSON.parse(readFileSync("public/texts/talmud-chapters.json", "utf8")) as Record<
  string,
  Range[]
>;
const plain = (text: unknown) =>
  String(text ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/[֑-ׇ]/g, "")
    .trim();

describe("the chapters of the Talmud", () => {
  it("are those the generator reads from the texts", () => {
    expect(() =>
      execFileSync("node", ["scripts/generate-talmud-chapters.mjs", "--check"], { stdio: "pipe" }),
    ).not.toThrow();
    // Reads every tractate: seconds, more under the load of the full suite.
  }, 30_000);

  it("start in Berakhot on the dafim of the Vilna edition", () => {
    expect(chapters.berakhot.map((range) => range.startDaf)).toEqual([
      "2a",
      "13a",
      "17b",
      "26a",
      "30b",
      "35a",
      "45a",
      "51b",
      "54a",
    ]);
  });

  it("start right after the end of the chapter before", () => {
    const misses: string[] = [];
    for (const [slug, ranges] of Object.entries(chapters)) {
      if (!ranges[0]?.startDaf) continue; // stored one entry per chapter
      const amudim = JSON.parse(readFileSync(`public/texts/talmud/${slug}.json`, "utf8")).he;
      const lines = (i: number) => [amudim[i]].flat(Infinity).map(plain);
      for (const range of ranges.slice(1)) {
        const i = range.startIdx;
        // The closing « הדרן עלך » of the chapter before, on this amud or the
        // one before; or, where the corpus lacks that marker, the opening
        // « מתני׳ » of this chapter's mishna.
        const closed = [...lines(i), ...lines(i - 1)].some((line) => line.startsWith("הדרן עלך"));
        const opens = lines(i).some((line) => line.startsWith("מתני"));
        if (!closed && !opens) misses.push(`${slug} ${range.chapter} (${range.startDaf})`);
      }
    }
    expect(misses).toEqual([]);
  });
});
