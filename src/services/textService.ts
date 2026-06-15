import type { TextStudyJsonEntry } from "../models/models";

export interface TextSection {
  index: number;
  label: string;
  he: string[];
}

export interface TextContent {
  title: string;
  type: string;
  sections: TextSection[];
}

interface TalmudChapter {
  chapter: number;
  startDaf: string;
  endDaf: string;
  startIdx: number;
  endIdx: number;
}

function tractateSlug(name: string): string {
  return name.toLowerCase().replace(/ /g, "-").replace(/['''`]/g, "");
}

function getFilePath(textStudy: TextStudyJsonEntry): string {
  const type = String(textStudy.type);
  const link = textStudy.link;

  if (type === "Tehilim") return "/texts/tehilim.json";

  if (type === "Mishna") {
    const tractate = link.replace("https://www.sefaria.org/Mishnah_", "").replace(/_/g, " ");
    return `/texts/mishna/${tractateSlug(tractate)}.json`;
  }

  if (type === "Talmud Bavli") {
    const tractate = link.replace("https://www.sefaria.org/", "").replace(/_/g, " ");
    return `/texts/talmud/${tractateSlug(tractate)}.json`;
  }

  if (type === "Tanakh") {
    return `/texts/tanakh/${textStudy.id}.json`;
  }

  throw new Error(`Type non supporté: ${type}`);
}

function getTalmudSlug(textStudy: TextStudyJsonEntry): string {
  const tractate = textStudy.link.replace("https://www.sefaria.org/", "").replace(/_/g, " ");
  return tractateSlug(tractate);
}

function cleanHtmlEntities(s: string): string {
  return s
    .replace(/&thinsp;/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

function normalizeLines(arr: unknown): string[] {
  if (!arr) return [];
  if (typeof arr === "string") {
    const s = cleanHtmlEntities(arr.trim());
    return s ? [s] : [];
  }
  if (Array.isArray(arr)) {
    const out: string[] = [];
    for (const item of arr) {
      if (typeof item === "string") {
        const s = cleanHtmlEntities(item.trim());
        if (s) out.push(s);
      } else if (Array.isArray(item)) {
        out.push(...normalizeLines(item));
      }
    }
    return out;
  }
  return [];
}

let talmudChaptersCache: Record<string, TalmudChapter[]> | null = null;

async function getTalmudChapters(): Promise<Record<string, TalmudChapter[]>> {
  if (talmudChaptersCache) return talmudChaptersCache;
  const res = await fetch("/texts/talmud-chapters.json");
  if (!res.ok) return {};
  talmudChaptersCache = await res.json();
  return talmudChaptersCache!;
}

export async function loadText(textStudy: TextStudyJsonEntry): Promise<TextContent> {
  const path = getFilePath(textStudy);
  const res = await fetch(path);
  if (!res.ok) {
    if (res.status === 404) {
      const err = new Error("MISSING_FILE");
      (err as Error & { isMissing: boolean }).isMissing = true;
      throw err;
    }
    throw new Error(`Texte non disponible (${res.status})`);
  }
  const data = await res.json();

  const type = String(textStudy.type);

  // ── Tehilim ──────────────────────────────────────────────────────────────
  if (type === "Tehilim") {
    const psalmNum = String(textStudy.link).split(".").pop() ?? "1";
    const psalm = data[psalmNum] ?? { he: [] };
    return {
      title: textStudy.name,
      type,
      sections: [
        {
          index: 1,
          label: textStudy.name,
          he: normalizeLines(psalm.he),
        },
      ],
    };
  }

  // ── Mishna ───────────────────────────────────────────────────────────────
  if (type === "Mishna") {
    const heChapters: unknown[] = data.he ?? [];
    const sections: TextSection[] = heChapters
      .map((ch: unknown, i: number) => ({
        index: i + 1,
        label: `Chapitre ${i + 1}`,
        he: normalizeLines(ch),
      }))
      .filter((s) => s.he.length > 0);
    return { title: data.title ?? textStudy.name, type, sections };
  }

  // ── Talmud Bavli ─────────────────────────────────────────────────────────
  if (type === "Talmud Bavli") {
    const heDaf: unknown[] = data.he ?? [];
    const slug = getTalmudSlug(textStudy);
    const chaptersMap = await getTalmudChapters();
    const chapterRanges = chaptersMap[slug] ?? [];

    if (chapterRanges.length > 0) {
      const sections: TextSection[] = chapterRanges.map((range) => {
        const lines: string[] = [];
        for (let i = range.startIdx; i <= range.endIdx && i < heDaf.length; i++) {
          lines.push(...normalizeLines(heDaf[i]));
        }
        const label =
          range.startDaf === range.endDaf
            ? `Chapitre ${range.chapter} (Daf ${range.startDaf})`
            : `Chapitre ${range.chapter} (Daf ${range.startDaf}–${range.endDaf})`;
        return {
          index: range.chapter,
          label,
          he: lines,
        };
      });
      return { title: data.title ?? textStudy.name, type, sections };
    }

    // Fallback: daf-by-daf if no chapter mapping available
    const sections: TextSection[] = [];
    for (let i = 0; i < heDaf.length; i++) {
      const he = normalizeLines(heDaf[i]);
      if (he.length === 0) continue;
      const daf = Math.floor(i / 2) + 2;
      const side = i % 2 === 0 ? "a" : "b";
      sections.push({
        index: sections.length + 1,
        label: `Daf ${daf}${side}`,
        he,
      });
    }
    return { title: data.title ?? textStudy.name, type, sections };
  }

  // ── Tanakh ───────────────────────────────────────────────────────────────
  if (type === "Tanakh") {
    const heChapters: unknown[] = data.he ?? [];
    // Reserved as a whole unit → flatten all chapters into one section
    if (textStudy.totalSections === 1) {
      const allLines: string[] = [];
      for (const ch of heChapters) allLines.push(...normalizeLines(ch));
      return {
        title: data.title ?? textStudy.name,
        type,
        sections: [{ index: 1, label: textStudy.name, he: allLines }],
      };
    }
    const sections: TextSection[] = heChapters
      .map((ch: unknown, i: number) => ({
        index: i + 1,
        label: `Chapitre ${i + 1}`,
        he: normalizeLines(ch),
      }))
      .filter((s) => s.he.length > 0);
    return { title: data.title ?? textStudy.name, type, sections };
  }

  throw new Error(`Type non supporté: ${type}`);
}
