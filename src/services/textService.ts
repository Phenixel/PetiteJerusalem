import type { TextStudyJsonEntry } from "../models/models";
import { formatNumberWithHebrew } from "./hebrewNumerals";
import { fetchTextResponse } from "./offlineTextStore";

/**
 * Loads the locally-stored texts under `public/texts/`.
 *
 * Files come from the public Sefaria dataset and are served as static assets, with no
 * external network call. This service turns a study text ({@link TextStudyJsonEntry})
 * into ready-to-read sections.
 */

/** Talmud: a daf side (e.g. "2a") with its lines, for continuous display with daf markers. */
export interface DafBlock {
  daf: string;
  lines: string[];
}

/**
 * Didascalie : la consigne de lecture qui accompagne un texte de tefila
 * (« le chalia'h tsibour dit », « à Roch Hodech on ajoute »…). Portée par le
 * fichier plutôt que par les locales : c'est du contenu, pas de l'interface, * mais donnée dans les trois langues, pour être lue dans celle du lecteur.
 */
export interface Rubric {
  fr: string;
  en: string;
  he: string;
}

/**
 * Fragment d'un paragraphe : de l'hébreu, mis en avant (`strong`) pour ce que
 * reprend l'assemblée, ou une didascalie glissée dans le fil du texte.
 */
export type TextRun =
  | { kind: "he"; text: string; strong?: boolean }
  | { kind: "rubric"; rubric: Rubric };

/**
 * Tefila : un paragraphe du texte, avec sa didascalie et ses mises en avant.
 * Un paragraphe = une ligne de {@link TextBlock.lines} (même index), pour que
 * les marque-pages et la translittération continuent de raisonner en lignes.
 */
export interface TextParagraph {
  /** Didascalie affichée au-dessus du paragraphe. */
  rubric?: Rubric;
  runs: TextRun[];
  /** Passage qui se dit plusieurs fois : affiché autant de fois. */
  repeat?: number;
  /**
   * Passage qu'on ne dit pas toujours (« certains disent », ajout d'une
   * occasion) : affiché en retrait, pour que le fil principal reste net.
   */
  muted?: boolean;
}

/**
 * Visual sub-division of a single-section text (chapter of a Na"kh book,
 * montée d'une paracha) : the text stays one continuous reading, and one
 * reservation unit, with a marker at each block start.
 */
export interface TextBlock {
  label: string;
  /** Tefila : le titre du bloc dans la langue du lecteur, quand il en a un. */
  labelText?: Rubric;
  lines: string[];
  /** Index of the block's first line within the section's flattened `he`. */
  offset: number;
  /**
   * Tefila : occasion du calendrier qui conditionne l'affichage du bloc
   * (« shabbat », « moed », « nissim »…, voir dailyCycles.activeOccasions).
   * Le lecteur ne montre le bloc que le jour où son ajout se dit, dans une
   * carte qui le distingue du fil du texte. Absent = toujours affiché.
   */
  when?: string;
  /**
   * Tefila : occasion qui OUVRE le bloc au lieu de le révéler. Le bloc est
   * toujours là, dans un encadré replié, les ajouts des dix jours de
   * pénitence se lisent aussi hors saison, mais ne doivent pas couper le fil
   * des Sli'hot le reste de l'année.
   */
  fold?: string;
  /**
   * Tefila : un bloc de variantes dont on ne dit que ce qui s'applique
   * (« après des mezonot », « à Roch Hodech »). Présenté à part du fil, chaque
   * variante précédée de son cas : on choisit, on ne lit pas tout.
   */
  variants?: boolean;
  /** Tefila : des paragraphes numérotés et séparés (les sept bénédictions). */
  numbered?: boolean;
  /** Tefila : le détail de mise en forme, ligne à ligne. */
  paragraphs?: TextParagraph[];
}

export interface TextSection {
  /** Section index (chapter / daf chapter). Doubles as the URL and reservation id. */
  index: number;
  label: string;
  /** Cleaned Hebrew lines (verses / mishnayot). */
  he: string[];
  /** Talmud only: the section's lines grouped by daf. */
  dafBlocks?: DafBlock[];
  /** Single-section texts: the same lines grouped by chapter / montée. */
  blocks?: TextBlock[];
  /** Parachiot : Targoum Onkelos aligné ligne à ligne sur `he` (chnei mikra). */
  targum?: string[];
}

export interface TextContent {
  title: string;
  type: string;
  sections: TextSection[];
}

/**
 * "Chapitre 2 (ב) · 3e montée · verset 14" : libellé d'une position (reprise,
 * marque-page). Unique implémentation, partagée par le lecteur de la
 * bibliothèque et la lecture quotidienne, les deux doivent décrire le même
 * verset de la même façon. `verseN` rend le libellé du numéro de verset
 * (i18n, ex. t("textReading.verseN", { n })).
 */
export function placeLabel(
  sections: TextSection[],
  sectionIndex: number | null,
  line: number,
  verseN: (n: number) => string,
): string {
  const section = sections.find((s) => s.index === (sectionIndex ?? 1)) ?? sections[0] ?? null;
  const parts: string[] = [];
  if (section && sections.length > 1) parts.push(section.label);
  const block = section?.blocks?.length
    ? [...section.blocks].reverse().find((b) => b.offset <= line)
    : undefined;
  // Tefila : les blocs du fil principal n'ont pas de titre, rien à décrire.
  if (block?.label) parts.push(block.label);
  const verse = block ? line - block.offset + 1 : line + 1;
  parts.push(verseN(verse));
  return parts.join(" · ");
}

/** Thrown when the text file is not available locally yet (404). */
export class MissingTextFileError extends Error {
  readonly isMissing = true;
  constructor() {
    super("MISSING_FILE");
    this.name = "MissingTextFileError";
  }
}

export interface TalmudChapter {
  chapter: number;
  startDaf: string;
  endDaf: string;
  startIdx: number;
  endIdx: number;
}

const SEFARIA_PREFIX = "https://www.sefaria.org/";

/** Tractate slug: lowercase, spaces → dashes, apostrophes removed. */
export function tractateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/['’‘`]/g, "");
}

/** Tractate name from a Sefaria link (optionally dropping the "Mishnah_" prefix). */
export function tractateFromLink(link: string, stripMishnah = false): string {
  let name = link.replace(SEFARIA_PREFIX, "");
  if (stripMishnah) name = name.replace(/^Mishnah_/, "");
  return name.replace(/_/g, " ");
}

export function resolveFilePath(textStudy: TextStudyJsonEntry): string {
  switch (String(textStudy.type)) {
    case "Tehilim":
      return "/texts/tehilim.json";
    case "Mishna":
      return `/texts/mishna/${tractateSlug(tractateFromLink(textStudy.link, true))}.json`;
    case "Talmud Bavli":
      return `/texts/talmud/${tractateSlug(tractateFromLink(textStudy.link))}.json`;
    case "Tanakh":
      return `/texts/tanakh/${textStudy.id}.json`;
    // Liturgie (Sli'hot, Brahot) : un fichier par entrée, nommé par sa
    // translittération latine, « ברכה אחרונה (Brakha A'harona) » →
    // brakha-aharona.json, comme les traités de la Michna et du Talmud.
    case "Slihot":
    case "Brahot": {
      const latin = textStudy.name.match(/\(([^)]+)\)\s*$/)?.[1] ?? String(textStudy.id);
      return `/texts/tefila/${tractateSlug(latin)}.json`;
    }
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
  const res = await fetchTextResponse("/texts/talmud-chapters.json");
  talmudChaptersCache = res.ok ? await res.json() : {};
  return talmudChaptersCache!;
}

function buildSection(index: number, label: string, he: string[]): TextSection {
  return { index, label, he };
}

/** Splits a he[chapter][verse] array into one section per non-empty chapter. */
function chaptersToSections(heChapters: unknown[]): TextSection[] {
  return heChapters
    .map((chapter, i) =>
      buildSection(i + 1, `Chapitre ${formatNumberWithHebrew(i + 1)}`, normalizeLines(chapter)),
    )
    .filter((s) => s.he.length > 0);
}

function loadTehilim(
  textStudy: TextStudyJsonEntry,
  data: Record<string, { he?: unknown }>,
): TextContent {
  const psalmNum = String(textStudy.link).split(".").pop() ?? "1";
  const psalm = data[psalmNum] ?? { he: [] };
  return {
    title: textStudy.name,
    type: "Tehilim",
    sections: [buildSection(1, textStudy.name, normalizeLines(psalm.he))],
  };
}

function parseTalmud(
  textStudy: TextStudyJsonEntry,
  data: { title?: string; he?: unknown[] },
  talmudChapters: Record<string, TalmudChapter[]>,
): TextContent {
  const heDaf = data.he ?? [];
  const slug = tractateSlug(tractateFromLink(textStudy.link));
  const chapterRanges = talmudChapters[slug] ?? [];
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
        dafBlocks.push({
          daf: `${Math.floor(i / 2) + 2}${i % 2 === 0 ? "a" : "b"}`,
          lines: dafLines,
        });
      }
      const dafRange =
        range.startDaf === range.endDaf
          ? `Daf ${range.startDaf}`
          : `Daf ${range.startDaf} à ${range.endDaf}`;
      const label = `Chapitre ${formatNumberWithHebrew(range.chapter)} · ${dafRange}`;
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
  data: {
    title?: string;
    he?: unknown[];
    targum?: unknown[];
    blockLabels?: string[];
    chapters?: string;
  },
): TextContent {
  const heChapters = data.he ?? [];
  const title = data.title ?? textStudy.name;

  // Reserved as a whole (totalSections=1) → one section, one continuous text,
  // but keep the groups (chapters / montées) as visual blocks instead of
  // flattening them away.
  if (textStudy.totalSections === 1) {
    // Legacy offline parasha files carry `chapters: "6-11"` (chapter-sliced):
    // number their chapter markers from the real starting chapter.
    const startChapter = Number(data.chapters?.match(/^(\d+)/)?.[1] ?? 1);
    const blocks: TextBlock[] = [];
    // Targoum aligné verset à verset : on avance dans les deux textes ensemble,
    // en ne retirant jamais une ligne d'un seul côté.
    const targumAll: string[] = [];
    let hasTargum = false;
    let offset = 0;
    heChapters.forEach((group, i) => {
      const targumGroup = Array.isArray(data.targum?.[i]) ? (data.targum[i] as unknown[]) : null;
      let lines: string[];
      if (targumGroup && Array.isArray(group)) {
        lines = [];
        (group as unknown[]).forEach((verse, j) => {
          const heLine =
            typeof verse === "string" ? cleanText(verse) : normalizeLines(verse).join(" ");
          if (!heLine) return;
          lines.push(heLine);
          const targumVerse = targumGroup[j];
          const cleaned = typeof targumVerse === "string" ? cleanText(targumVerse) : "";
          targumAll.push(cleaned);
          if (cleaned) hasTargum = true;
        });
      } else {
        lines = normalizeLines(group);
        for (let k = 0; k < lines.length; k++) targumAll.push("");
      }
      if (lines.length === 0) return;
      const label = data.blockLabels?.[i] ?? `Chapitre ${formatNumberWithHebrew(startChapter + i)}`;
      blocks.push({ label, lines, offset });
      offset += lines.length;
    });
    const allLines = blocks.flatMap((b) => b.lines);
    const section = buildSection(1, textStudy.name, allLines);
    if (blocks.length > 1) section.blocks = blocks;
    if (hasTargum) section.targum = targumAll;
    return { title, type: "Tanakh", sections: [section] };
  }

  return { title, type: "Tanakh", sections: chaptersToSections(heChapters) };
}

/**
 * Format des fichiers de tefila (public/texts/tefila/*) : une suite de blocs,
 * chacun avec ses lignes, un titre facultatif (séparations des Sli'hot,
 * bénédictions de la brakha a'harona) et une occasion facultative, `when`
 * pour les ajouts qui ne se disent qu'à certaines dates (voir TextBlock.when),
 * `fold` pour ceux qui restent disponibles toute l'année dans un encadré
 * replié (voir TextBlock.fold).
 *
 * Une ligne est soit de l'hébreu brut, soit un paragraphe détaillé :
 *
 *   {
 *     "rubric": { "fr": "…", "en": "…", "he": "…" },   // didascalie au-dessus
 *     "he": ["hébreu", { "b": "réponse de l'assemblée" },
 *            { "r": { "fr": "…", "en": "…", "he": "…" } }, "suite"],
 *     "repeat": 2                                       // se dit deux fois
 *   }
 *
 * `he` accepte aussi une simple chaîne. Les didascalies ne comptent pas dans
 * le texte hébreu de la ligne : les marque-pages, la translittération et le
 * repérage des versets ne voient que ce qui se lit.
 */
interface TefilaRun {
  /** Hébreu mis en avant (ce que reprend l'assemblée). */
  b?: string;
  /** Didascalie insérée dans le fil du texte. */
  r?: Rubric;
}

interface TefilaFileLine {
  rubric?: Rubric;
  he?: string | (string | TefilaRun)[];
  repeat?: number;
  muted?: boolean;
}

interface TefilaFileBlock {
  label?: string;
  labelText?: Rubric;
  when?: string;
  fold?: string;
  variants?: boolean;
  numbered?: boolean;
  lines?: (string | TefilaFileLine)[];
}

/** Un paragraphe du fichier → ses fragments, ou null si rien ne se lit. */
function parseTefilaLine(raw: string | TefilaFileLine): TextParagraph | null {
  if (typeof raw === "string") {
    const text = cleanText(raw);
    return text ? { runs: [{ kind: "he", text }] } : null;
  }
  const parts = Array.isArray(raw.he) ? raw.he : raw.he ? [raw.he] : [];
  const runs: TextRun[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      const text = cleanText(part);
      if (text) runs.push({ kind: "he", text });
    } else if (part.b) {
      const text = cleanText(part.b);
      if (text) runs.push({ kind: "he", text, strong: true });
    } else if (part.r) {
      runs.push({ kind: "rubric", rubric: part.r });
    }
  }
  if (!runs.some((run) => run.kind === "he")) return null;
  const paragraph: TextParagraph = { runs };
  if (raw.rubric) paragraph.rubric = raw.rubric;
  if (raw.repeat && raw.repeat > 1) paragraph.repeat = raw.repeat;
  if (raw.muted) paragraph.muted = true;
  return paragraph;
}

/** Le texte hébreu d'un paragraphe, didascalies exclues. */
function paragraphText(paragraph: TextParagraph): string {
  return paragraph.runs
    .filter((run): run is Extract<TextRun, { kind: "he" }> => run.kind === "he")
    .map((run) => run.text)
    .join(" ");
}

function loadTefila(
  textStudy: TextStudyJsonEntry,
  data: { title?: string; blocks?: TefilaFileBlock[] },
): TextContent {
  const blocks: TextBlock[] = [];
  let offset = 0;
  for (const raw of data.blocks ?? []) {
    const paragraphs = (raw.lines ?? [])
      .map(parseTefilaLine)
      .filter((p): p is TextParagraph => p !== null);
    if (paragraphs.length === 0) continue;
    const block: TextBlock = {
      label: raw.label ?? "",
      lines: paragraphs.map(paragraphText),
      offset,
      paragraphs,
    };
    if (raw.labelText) block.labelText = raw.labelText;
    if (raw.when) block.when = raw.when;
    if (raw.fold) block.fold = raw.fold;
    if (raw.variants) block.variants = true;
    if (raw.numbered) block.numbered = true;
    blocks.push(block);
    offset += block.lines.length;
  }
  const section = buildSection(
    1,
    textStudy.name,
    blocks.flatMap((b) => b.lines),
  );
  // Toujours des blocs, même seul : c'est là que vit la mise en forme
  // (didascalies, réponses de l'assemblée, répétitions).
  section.blocks = blocks;
  return { title: data.title ?? textStudy.name, type: String(textStudy.type), sections: [section] };
}

/**
 * Pure parse of an already-loaded text file into ready-to-read sections.
 * Shared by the runtime reader (via {@link loadText}) and the SEO prerender
 * (which reads the files from disk), so both produce identical content.
 * `talmudChapters` is only needed for the Talmud (chapter → daf-range map).
 */
export function parseContent(
  textStudy: TextStudyJsonEntry,
  data: unknown,
  talmudChapters: Record<string, TalmudChapter[]> = {},
): TextContent {
  switch (String(textStudy.type)) {
    case "Tehilim":
      return loadTehilim(textStudy, data as Record<string, { he?: unknown }>);
    case "Mishna": {
      const d = data as { title?: string; he?: unknown[] };
      return {
        title: d.title ?? textStudy.name,
        type: "Mishna",
        sections: chaptersToSections(d.he ?? []),
      };
    }
    case "Talmud Bavli":
      return parseTalmud(textStudy, data as { title?: string; he?: unknown[] }, talmudChapters);
    case "Tanakh":
      return loadTanakh(textStudy, data as { title?: string; he?: unknown[] });
    case "Slihot":
    case "Brahot":
      return loadTefila(textStudy, data as { title?: string; blocks?: TefilaFileBlock[] });
    default:
      throw new Error(`Type non supporté : ${textStudy.type}`);
  }
}

export async function loadText(textStudy: TextStudyJsonEntry): Promise<TextContent> {
  // Copie locale (téléchargement hors ligne) d'abord, réseau sinon.
  const res = await fetchTextResponse(resolveFilePath(textStudy));
  if (!res.ok) {
    if (res.status === 404) throw new MissingTextFileError();
    throw new Error(`Texte non disponible (${res.status})`);
  }
  const data = await res.json();
  const talmudChapters = String(textStudy.type) === "Talmud Bavli" ? await getTalmudChapters() : {};
  return parseContent(textStudy, data, talmudChapters);
}
