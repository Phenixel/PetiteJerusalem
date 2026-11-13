import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson } from "../models/models";

/**
 * The translation in the library reaches the commentaries: with the setting
 * on, Rashi on the Torah comes translated in the study panel as in the chnei
 * mikra, in the language the reader would take; so do Rashi on the Nach and
 * the Tosafot Yom Tov on Avot, while the Bartenura, which has no translation
 * we may take, stays in Hebrew without failing. And every page that reads
 * texts one after the other (DailyReadingItem, which follows the setting)
 * offers the « Translation » command in its reading menu: otherwise a
 * translation turned on elsewhere shows there without a way to turn it off.
 */

const PUBLIC = resolve(__dirname, "../../public");
const SRC = resolve(__dirname, "..");

const { fetchTextResponse } = vi.hoisted(() => ({ fetchTextResponse: vi.fn() }));
vi.mock("../services/offlineTextStore", () => ({ fetchTextResponse }));

/** Serves the repository's text files, as the site would. */
async function serve(path: string): Promise<Response> {
  const file = resolve(PUBLIC, `.${path}`);
  if (!existsSync(file)) return new Response("", { status: 404 });
  return new Response(readFileSync(file, "utf8"));
}

const entries = (textStudiesJson as TextStudiesJson).textStudies;
const berechit = entries.find((e) => e.id === 264)!;
const josue = entries.find((e) => e.type === "Tanakh" && e.livre === "Nevi'im (Prophets)")!;

const prefer = (lang: string) => (available: readonly string[]) =>
  available.includes(lang) ? lang : null;

describe("Rashi in the study panel, translation on", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchTextResponse.mockReset();
    fetchTextResponse.mockImplementation(serve);
  });

  it("carries the French translation under each comment of Bereshit, with its AI source", async () => {
    const { loadTanakhRashi } = await import("../services/textService");
    const { groups, sources } = await loadTanakhRashi(berechit, prefer("fr"));
    const first = groups.flat(2)[0];
    expect(first.lead).toMatch(/^בראשית/);
    expect(first.tr).toMatch(/^<b>Au commencement\.<\/b>/);
    expect(sources.some((source) => source.ai)).toBe(true);
  });

  it("takes English when it is the language picked", async () => {
    const { loadTanakhRashi } = await import("../services/textService");
    const { groups, sources } = await loadTanakhRashi(berechit, prefer("en"));
    expect(groups.flat(2)[0].tr).toBeTruthy();
    expect(sources.some((source) => source.ai)).toBe(false);
  });

  it("stays in Hebrew when the translation is off", async () => {
    const { loadTanakhRashi } = await import("../services/textService");
    const { groups, sources } = await loadTanakhRashi(berechit, null);
    expect(groups.flat(2).some((comment) => comment.tr)).toBe(false);
    expect(sources).toEqual([]);
  });

  it("carries the translation of Rashi on the Nach", async () => {
    const { loadTanakhRashi } = await import("../services/textService");
    const en = await loadTanakhRashi(josue, prefer("en"));
    const first = en.groups.flat(2)[0];
    expect(first.lead.replace(/[\u0591-\u05c7]/g, "")).toMatch(/^ויהי אחרי מות משה/);
    expect(first.tr).toMatch(/^<b>And after the death of Moshe\.<\/b>/);
    expect(en.sources.map((source) => source.by)).toEqual(["Yaakov Y. H. Pupko"]);
  });

  it("gives a psalm read alone the translation of its chapter in the book of Tehilim", async () => {
    const { loadTanakhRashi } = await import("../services/textService");
    const psalm = entries.find((e) => String(e.type) === "Tehilim" && /\.23$/.test(e.link))!;
    const { groups, sources } = await loadTanakhRashi(psalm, prefer("en"));
    expect(groups).toHaveLength(1);
    expect(groups[0].flat().some((comment) => comment.tr)).toBe(true);
    expect(sources.map((source) => source.by)).toEqual(["A. J. Rosenberg"]);
  });
});

describe("the commentaries of the Mishna, translation on", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchTextResponse.mockReset();
    fetchTextResponse.mockImplementation(serve);
  });

  const avot = entries.find((e) => e.type === "Mishna" && /Pirkei_Avot|Avot/.test(e.link))!;
  const berakhot = entries.find((e) => e.type === "Mishna" && /Berakhot/.test(e.link))!;

  it("translates the Tosafot Yom Tov on Avot, and leaves the Bartenura in Hebrew", async () => {
    const { loadMishnaMeforshim } = await import("../services/textService");
    for (const lang of ["en", "fr"]) {
      const m = await loadMishnaMeforshim(avot, prefer(lang));
      const tyt = m.tosafotYomTov.flat(2);
      expect(tyt.length, `${lang}`).toBeGreaterThan(300);
      expect(
        tyt.every((comment) => comment.tr),
        `${lang}`,
      ).toBe(true);
      expect(
        m.bartenura.flat(2).some((comment) => comment.tr),
        `${lang}`,
      ).toBe(false);
      expect(
        m.sources.some((source) => source.ai),
        `${lang}`,
      ).toBe(lang === "fr");
    }
  });

  it("reads a tractate without translation in Hebrew, without failing", async () => {
    const { loadMishnaMeforshim } = await import("../services/textService");
    const m = await loadMishnaMeforshim(berakhot, prefer("fr"));
    expect(m.bartenura.flat(2).length).toBeGreaterThan(0);
    expect(m.bartenura.flat(2).some((comment) => comment.tr)).toBe(false);
    expect(m.sources).toEqual([]);
  });

  it("stays in Hebrew when the translation is off", async () => {
    const { loadMishnaMeforshim } = await import("../services/textService");
    const m = await loadMishnaMeforshim(avot, null);
    expect(m.tosafotYomTov.flat(2).some((comment) => comment.tr)).toBe(false);
    expect(m.sources).toEqual([]);
  });
});

describe("the « Translation » command on the pages that read texts one after the other", () => {
  /** The .vue files of src/views, recursively. */
  const views = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
      d.isDirectory()
        ? views(resolve(dir, d.name))
        : d.name.endsWith(".vue")
          ? [resolve(dir, d.name)]
          : [],
    );

  const pages = views(resolve(SRC, "views")).filter((file) => {
    const source = readFileSync(file, "utf8");
    return source.includes("<DailyReadingItem") && source.includes("<ReadingMenu");
  });

  it("finds the pages concerned", () => {
    expect(pages.map((file) => file.split("/").pop())).toEqual(
      expect.arrayContaining(["ChneiMikraPage.vue", "TehilimDayPage.vue"]),
    );
  });

  it.each(pages.map((file) => [file.split("/src/")[1], file]))(
    "%s gives its reading menu the translation languages",
    (_name, file) => {
      const menu = readFileSync(file, "utf8").match(/<ReadingMenu\b[^>]*>/)?.[0] ?? "";
      expect(menu).toContain(':translation-langs="');
      expect(menu).toContain(':translation-lang="');
    },
  );
});
