import type { TextStudyJsonEntry } from "../models/models";

/**
 * Loads the locally-stored texts under `public/texts/`.
 *
 * Files come from the public Sefaria dataset and are served as static assets — no
 * external network call. This service turns a study text ({@link TextStudyJsonEntry})
 * into ready-to-read sections.
 */

/** Talmud: a daf side (e.g. "2a") with its lines, for continuous display with daf markers. */
export interface DafBlock {
  daf: string;
  lines: string[];
}

export interface TextSection {
  /** Section index (chapter / daf chapter). Doubles as the URL and reservation id. */
  index: number;
  label: string;
  /** Cleaned Hebrew lines (verses / mishnayot). */
  he: string[];
  /** Talmud only: the section's lines grouped by daf. */
  dafBlocks?: DafBlock[];
}

export interface TextContent {
  title: string;
  type: string;
  sections: TextSection[];
}

/** Thrown when the text file is not available locally yet (404). */
export class MissingTextFileError extends Error {
  readonly isMissing = true;
  constructor() {
    super("MISSING_FILE");
    this.name = "MissingTextFileError";
  }
}

interface TalmudChapter {
  chapter: number;
  startDaf: string;
  endDaf: string;
  startIdx: number;
  endIdx: number;
}

const SEFARIA_PREFIX = "https://www.sefaria.org/";

/** Tractate slug: lowercase, spaces → dashes, apostrophes removed. */
function tractateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/['’‘`]/g, "");
}

/** Tractate name from a Sefaria link (optionally dropping the "Mishnah_" prefix). */
function tractateFromLink(link: string, stripMishnah = false): string {
  let name = link.replace(SEFARIA_PREFIX, "");
  if (stripMishnah) name = name.replace(/^Mishnah_/, "");
  return name.replace(/_/g, " ");
}

function resolveFilePath(textStudy: TextStudyJsonEntry): string {
  switch (String(textStudy.type)) {
    case "Tehilim":
      return "/texts/tehilim.json";
    case "Mishna":
      return `/texts/mishna/${tractateSlug(tractateFromLink(textStudy.link, true))}.json`;
    case "Talmud Bavli":
      return `/texts/talmud/${tractateSlug(tractateFromLink(textStudy.link))}.json`;
    case "Tanakh":
      return `/texts/tanakh/${textStudy.id}.json`;
    default:
      throw new Error(`Type non supporté : ${textStudy.type}`);
  }
}

function cleanText(s: string): string {
  return s
    .replace(/<[^>]*>/g, "") // HTML tags (footnotes, formatting)
    .replace(/\{[א-ת]\}/g, "") // parasha markers, e.g. {petucha}/{setuma}
    .replace(/&thinsp;/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Flattens a value (string | nested array) into non-empty, cleaned lines. */
function normalizeLines(value: unknown): string[] {
  if (typeof value === "string") {
    const s = cleanText(value);
    return s ? [s] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeLines(item));
  }
  return [];
}

let talmudChaptersCache: Record<string, TalmudChapter[]> | null = null;

/** Chapter → daf-range map, fetched once and memoized. */
async function getTalmudChapters(): Promise<Record<string, TalmudChapter[]>> {
  if (talmudChaptersCache) return talmudChaptersCache;
  const res = await fetch("/texts/talmud-chapters.json");
  talmudChaptersCache = res.ok ? await res.json() : {};
  return talmudChaptersCache!;
}

function buildSection(index: number, label: string, he: string[]): TextSection {
  return { index, label, he };
}

/** Splits a he[chapter][verse] array into one section per non-empty chapter. */
function chaptersToSections(heChapters: unknown[]): TextSection[] {
  return heChapters
    .map((chapter, i) => buildSection(i + 1, `Chapitre ${i + 1}`, normalizeLines(chapter)))
    .filter((s) => s.he.length > 0);
}

function loadTehilim(textStudy: TextStudyJsonEntry, data: Record<string, { he?: unknown }>): TextContent {
  const psalmNum = String(textStudy.link).split(".").pop() ?? "1";
  const psalm = data[psalmNum] ?? { he: [] };
  return {
    title: textStudy.name,
    type: "Tehilim",
    sections: [buildSection(1, textStudy.name, normalizeLines(psalm.he))],
  };
}

async function loadTalmud(
  textStudy: TextStudyJsonEntry,
  data: { title?: string; he?: unknown[] },
): Promise<TextContent> {
  const heDaf = data.he ?? [];
  const slug = tractateSlug(tractateFromLink(textStudy.link));
  const chapterRanges = (await getTalmudChapters())[slug] ?? [];
  const title = data.title ?? textStudy.name;

  if (chapterRanges.length > 0) {
    const sections = chapterRanges.map((range) => {
      const lines: string[] = [];
      const dafBlocks: DafBlock[] = [];
      // Each index in `he` is one daf side: index 0 = 2a, 1 = 2b, 2 = 3a…
      for (let i = range.startIdx; i <= range.endIdx && i < heDaf.length; i++) {
        const dafLines = normalizeLines(heDaf[i]);
        if (dafLines.length === 0) continue;
        lines.push(...dafLines);
        dafBlocks.push({ daf: `${Math.floor(i / 2) + 2}${i % 2 === 0 ? "a" : "b"}`, lines: dafLines });
      }
      const label =
        range.startDaf === range.endDaf
          ? `Chapitre ${range.chapter} (Daf ${range.startDaf})`
          : `Chapitre ${range.chapter} (Daf ${range.startDaf}–${range.endDaf})`;
      return { index: range.chapter, label, he: lines, dafBlocks };
    });
    return { title, type: "Talmud Bavli", sections };
  }

  // Fallback: daf by daf when no chapter mapping is available.
  const sections: TextSection[] = [];
  for (let i = 0; i < heDaf.length; i++) {
    const he = normalizeLines(heDaf[i]);
    if (he.length === 0) continue;
    const daf = Math.floor(i / 2) + 2;
    const side = i % 2 === 0 ? "a" : "b";
    sections.push(buildSection(sections.length + 1, `Daf ${daf}${side}`, he));
  }
  return { title, type: "Talmud Bavli", sections };
}

function loadTanakh(
  textStudy: TextStudyJsonEntry,
  data: { title?: string; he?: unknown[] },
): TextContent {
  const heChapters = data.he ?? [];
  const title = data.title ?? textStudy.name;

  // Reserved as a whole (totalSections=1) → flatten everything into one section.
  if (textStudy.totalSections === 1) {
    const allLines = heChapters.flatMap((chapter) => normalizeLines(chapter));
    return { title, type: "Tanakh", sections: [buildSection(1, textStudy.name, allLines)] };
  }

  return { title, type: "Tanakh", sections: chaptersToSections(heChapters) };
}

export async function loadText(textStudy: TextStudyJsonEntry): Promise<TextContent> {
  const res = await fetch(resolveFilePath(textStudy));
  if (!res.ok) {
    if (res.status === 404) throw new MissingTextFileError();
    throw new Error(`Texte non disponible (${res.status})`);
  }
  const data = await res.json();

  switch (String(textStudy.type)) {
    case "Tehilim":
      return loadTehilim(textStudy, data);
    case "Mishna":
      return { title: data.title ?? textStudy.name, type: "Mishna", sections: chaptersToSections(data.he ?? []) };
    case "Talmud Bavli":
      return loadTalmud(textStudy, data);
    case "Tanakh":
      return loadTanakh(textStudy, data);
    default:
      throw new Error(`Type non supporté : ${textStudy.type}`);
  }
}
