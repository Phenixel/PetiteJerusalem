import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../locales/fr";
import en from "../locales/en";
import he from "../locales/he";
import {
  HELP_GUIDES,
  HELP_ILLUSTRATIONS,
  HELP_TOPICS,
  type HelpBlock,
  type HelpText,
  guidesByTopic,
  relatedGuides,
} from "../content/help/catalog";
import { HELP_VERSIONS, passageChapter, videoChapters } from "../content/help/versions";
import { HELP_ILLUSTRATION_COMPONENTS } from "../components/help/illustrations";
import { WHATS_NEW_VERSION } from "../composables/useWhatsNew";
import { parseHelpVideos } from "../services/helpVideos";

/**
 * The help center (docs/help-center.md, docs/design.md "The help center
 * shows how, part by part").
 *
 * What must hold:
 * - every guide reads in the three languages, a borrowed text names a key
 *   the three locales have, and the French follows the house typography;
 * - a guide's address is unique, its topic exists, its drawn screenshots
 *   exist, its links lead into the app;
 * - the page of a version answers for every passage of its video, and
 *   every passage it answers for is in the video
 *   (src/content/help/whatsNewChapters.json, written by the promo project);
 * - the list of videos the site serves (public/help/videos.json) is valid,
 *   and a newer list an older app cannot read loses an entry, not the page;
 * - the app asks its site for that list, and falls back on its own copy.
 *
 * The pages themselves: helpCenterPages.test.ts.
 */

const ROOT = join(__dirname, "..", "..");
const LOCALES = { fr, en, he } as Record<string, unknown>;

type Messages = { [key: string]: string | Messages };

function lookup(messages: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => (node as Messages)?.[part], messages);
}

/** Every text of the catalog, with where it comes from. */
function allTexts(): { where: string; text: HelpText }[] {
  const texts: { where: string; text: HelpText }[] = [];
  for (const topic of HELP_TOPICS) texts.push({ where: `topic ${topic.id}`, text: topic.title });
  for (const guide of HELP_GUIDES) {
    texts.push({ where: `${guide.slug} title`, text: guide.title });
    texts.push({ where: `${guide.slug} summary`, text: guide.summary });
    guide.blocks.forEach((block: HelpBlock, i) => {
      const where = `${guide.slug} block ${i}`;
      if (block.kind === "text") texts.push({ where, text: block.text });
      if (block.kind === "point") {
        texts.push({ where: `${where} title`, text: block.title });
        texts.push({ where: `${where} text`, text: block.text });
      }
      if (block.kind === "link") texts.push({ where, text: block.label });
    });
  }
  return texts;
}

/** Every text of the versions' pages, with where it comes from. */
function versionTexts(): { where: string; text: HelpText }[] {
  const texts: { where: string; text: HelpText }[] = [];
  for (const version of HELP_VERSIONS) {
    texts.push({ where: `${version.version} intro`, text: version.intro });
    for (const passage of version.passages) {
      const where = `${version.version} ${passage.chapter}`;
      texts.push({ where: `${where} title`, text: passage.title });
      passage.questions.forEach(({ question, answer }, i) => {
        texts.push({ where: `${where} question ${i}`, text: question });
        texts.push({ where: `${where} answer ${i}`, text: answer });
      });
      if (passage.link) texts.push({ where: `${where} link`, text: passage.link.label });
    }
  }
  return texts;
}

/** What is missing from texts that must read in the three languages. */
function languageProblems(texts: { where: string; text: HelpText }[]): string[] {
  const problems: string[] = [];
  for (const { where, text } of texts) {
    if ("key" in text) {
      for (const [locale, messages] of Object.entries(LOCALES)) {
        if (typeof lookup(messages, text.key) !== "string") {
          problems.push(`${where}: ${text.key} missing in ${locale}`);
        }
      }
    } else {
      for (const locale of ["fr", "en", "he"] as const) {
        if (!text[locale]?.trim()) problems.push(`${where}: no ${locale}`);
      }
    }
  }
  return problems;
}

/** The French typography rules of frenchTypography.test.ts, for one string. */
function frenchTypographyErrors(value: string): string[] {
  const errors: string[] = [];
  if (/ [!?;:»]/.test(value)) errors.push("an ordinary space before ! ? ; : or »");
  if (/« /.test(value)) errors.push("an ordinary space after «");
  if (/[^\s ]([!?;])/.test(value.replace(/\.\.\.|…/g, ""))) {
    errors.push("no narrow no-break space before ! ? ;");
  }
  return errors;
}

describe("the guides", () => {
  it("read in the three languages, borrowed texts included", () => {
    expect(languageProblems(allTexts())).toEqual([]);
  });

  it("write French with its no-break spaces", () => {
    const problems = allTexts().flatMap(({ where, text }) =>
      "key" in text ? [] : frenchTypographyErrors(text.fr).map((error) => `${where}: ${error}`),
    );
    expect(problems, "U+202F before ! ? ;, U+00A0 before : and inside « » (see CLAUDE.md)").toEqual(
      [],
    );
  });

  it("each have their own address, a known topic, drawn screenshots that exist", () => {
    const slugs = HELP_GUIDES.map((guide) => guide.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);

    const topics = new Set(HELP_TOPICS.map((topic) => topic.id));
    expect(HELP_GUIDES.filter((guide) => !topics.has(guide.topic)).map((g) => g.slug)).toEqual([]);

    expect(HELP_ILLUSTRATIONS.filter((name) => !HELP_ILLUSTRATION_COMPONENTS[name])).toEqual([]);
    const source = readFileSync(join(ROOT, "src/components/help/illustrations.ts"), "utf8");
    const files = [...source.matchAll(/import\("\.\.\/mock\/(\w+\.vue)"\)/g)].map(([, f]) => f);
    expect(files).toHaveLength(HELP_ILLUSTRATIONS.length);
    expect(files.filter((file) => !existsSync(join(ROOT, "src/components/mock", file)))).toEqual(
      [],
    );
  });

  it("lead into the app through routes it has", () => {
    const routes = readFileSync(join(ROOT, "src/router/routes.ts"), "utf8");
    const paths = [...routes.matchAll(/^\s*path: "(\/[^"]*)"/gm)].map(([, path]) => path);
    for (const guide of HELP_GUIDES) {
      for (const block of guide.blocks) {
        if (block.kind !== "link") continue;
        expect(paths, `${guide.slug} → ${block.to}`).toContain(block.to);
      }
    }
  });

  it("are grouped by topic, in the topics' order, and suggest others", () => {
    const groups = guidesByTopic();
    const order = HELP_TOPICS.map((topic) => topic.id);
    expect(groups.map((group) => group.topic.id)).toEqual(
      order.filter((id) => HELP_GUIDES.some((guide) => guide.topic === id)),
    );
    const related = relatedGuides("barre-de-lecture");
    expect(related[0].topic).toBe("reading");
    expect(related.map((guide) => guide.slug)).not.toContain("barre-de-lecture");
  });
});

describe("the pages of the versions", () => {
  const routes = readFileSync(join(ROOT, "src/router/routes.ts"), "utf8");
  const paths = [...routes.matchAll(/^\s*path: "(\/[^"]*)"/gm)].map(([, path]) => path);

  it("read in the three languages, the French with its no-break spaces", () => {
    expect(languageProblems(versionTexts())).toEqual([]);
    const typography = versionTexts().flatMap(({ where, text }) =>
      "key" in text ? [] : frenchTypographyErrors(text.fr).map((error) => `${where}: ${error}`),
    );
    expect(typography, "U+202F before ! ? ;, U+00A0 before : and inside « »").toEqual([]);
  });

  it("include the version whose video the app plays", () => {
    expect(HELP_VERSIONS.map((version) => version.version)).toContain(WHATS_NEW_VERSION);
  });

  it("answer for every passage of the video, and only for those", () => {
    for (const version of HELP_VERSIONS) {
      const answered = version.passages.map((passage) => passage.chapter);
      expect(new Set(answered).size, `${version.version}: a passage twice`).toBe(answered.length);
      const videos = videoChapters(version.version);
      for (const [locale, chapters] of Object.entries(videos)) {
        const missing = chapters.map((c) => c.id).filter((id) => !answered.includes(id));
        expect(missing, `${version.version} ${locale}: chapters without their questions`).toEqual(
          [],
        );
      }
      // Each passage is in the French video, which shows them all, in its order.
      const french = (videos.fr ?? []).map((chapter) => chapter.id);
      expect(answered, `${version.version}: passages not in the French video`).toEqual(french);
    }
  });

  it("know where each passage starts, in each language's video", () => {
    const chapters = videoChapters(WHATS_NEW_VERSION);
    expect(Object.keys(chapters).sort()).toEqual(["en", "fr", "he"]);
    for (const list of Object.values(chapters)) {
      list.forEach((chapter, i) => {
        expect(chapter.end).toBeGreaterThan(chapter.start);
        if (i > 0) expect(chapter.start).toBe(list[i - 1].end);
      });
    }
    // The Hebrew video has no passage on the translations (into French and
    // English): its page keeps the questions, without « Revoir ce passage ».
    expect(passageChapter(WHATS_NEW_VERSION, "he", "translation")).toBeNull();
    expect(passageChapter(WHATS_NEW_VERSION, "fr", "translation")?.start).toBeGreaterThan(0);
    // A language without its video reads the French one's.
    expect(passageChapter(WHATS_NEW_VERSION, "de", "calme")).toEqual(
      passageChapter(WHATS_NEW_VERSION, "fr", "calme"),
    );
  });

  it("lead to guides that exist and into the app through routes it has", () => {
    const slugs = new Set(HELP_GUIDES.map((guide) => guide.slug));
    for (const version of HELP_VERSIONS) {
      for (const passage of version.passages) {
        const where = `${version.version} ${passage.chapter}`;
        for (const slug of passage.guides ?? [])
          expect(slugs, `${where} → ${slug}`).toContain(slug);
        if (passage.link) expect(paths, `${where} → ${passage.link.to}`).toContain(passage.link.to);
        expect(passage.questions.length, `${where}: no question`).toBeGreaterThan(0);
      }
    }
    expect(paths).toContain("/aide/nouveautes/:version");
  });
});

describe("the videos the site serves", () => {
  const file = join(ROOT, "public/help/videos.json");

  it("are a valid list, in the three languages, typeset", () => {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    expect(Array.isArray(raw.videos)).toBe(true);
    const videos = parseHelpVideos(raw);
    // Nothing the app would leave out: a mistyped entry fails here, not silently.
    expect(videos).toHaveLength(raw.videos.length);
    const slugs = new Set(HELP_GUIDES.map((guide) => guide.slug));
    const topics = new Set<string>(HELP_TOPICS.map((topic) => topic.id));
    const problems = videos.flatMap((video) => [
      ...(video.title.en ? [] : [`${video.youtube}: no English title`]),
      ...(video.title.he ? [] : [`${video.youtube}: no Hebrew title`]),
      ...frenchTypographyErrors(video.title.fr).map((error) => `${video.youtube}: ${error}`),
      ...(video.guide && !slugs.has(video.guide)
        ? [`${video.youtube}: no guide ${video.guide}`]
        : []),
      ...(video.topic && !topics.has(video.topic)
        ? [`${video.youtube}: no topic ${video.topic}`]
        : []),
    ]);
    expect(problems).toEqual([]);
  });

  it("are read by an older app without breaking: what it cannot show is left out", () => {
    const videos = parseHelpVideos({
      videos: [
        { youtube: "AbCdEfGhIjK", title: { fr: "Le Sidour" }, duration: "3:42", chapters: [1] },
        { youtube: "not-an-id", title: { fr: "Mauvais identifiant" } },
        { youtube: "aaaaaaaaaaa", title: { en: "No French" } },
        { youtube: "bbbbbbbbbbb", title: { fr: "Durée illisible" }, duration: "long" },
        "a string",
      ],
    });
    expect(videos).toEqual([
      { youtube: "AbCdEfGhIjK", title: { fr: "Le Sidour" }, duration: "3:42" },
      { youtube: "bbbbbbbbbbb", title: { fr: "Durée illisible" } },
    ]);
    expect(parseHelpVideos(null)).toEqual([]);
    expect(parseHelpVideos({ videos: "none" })).toEqual([]);
  });
});

describe("loading the videos", () => {
  // Each test loads the service afresh, as an app opening would.
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock("../composables/useNativeApp");
    vi.resetModules();
  });

  const LIST = { videos: [{ youtube: "AbCdEfGhIjK", title: { fr: "Le Sidour" } }] };

  it("the app asks its site, and falls back on its own copy offline", async () => {
    vi.doMock("../composables/useNativeApp", () => ({ isNativeApp: true }));
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: true, json: async () => LIST });
    vi.stubGlobal("fetch", fetch);
    const { loadHelpVideos, HELP_VIDEOS_PATH } = await import("../services/helpVideos");
    const videos = await loadHelpVideos();
    expect(fetch.mock.calls[0][0]).toMatch(/^https:\/\/.+\/help\/videos\.json$/);
    expect(fetch.mock.calls[1][0]).toBe(HELP_VIDEOS_PATH);
    expect(videos.map((video) => video.youtube)).toEqual(["AbCdEfGhIjK"]);
  });

  it("the site reads its own file, and nothing at all is an empty list", async () => {
    vi.doMock("../composables/useNativeApp", () => ({ isNativeApp: false }));
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetch);
    const { loadHelpVideos } = await import("../services/helpVideos");
    expect(await loadHelpVideos()).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
