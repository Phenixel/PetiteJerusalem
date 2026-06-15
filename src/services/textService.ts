import type { TextStudyJsonEntry } from "../models/models";

export interface TextSection {
  index: number;
  label: string;
  he: string[];
  en: string[];
}

export interface TextContent {
  title: string;
  type: string;
  sections: TextSection[];
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

function cleanHtmlEntities(s: string): string {
  return s
    .replace(/&thinsp;/g, " ")
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

function dafLabel(arrayIndex: number): string {
  const daf = Math.floor(arrayIndex / 2) + 1;
  const side = arrayIndex % 2 === 0 ? "a" : "b";
  return `${daf}${side}`;
}

export async function loadText(textStudy: TextStudyJsonEntry): Promise<TextContent> {
  const path = getFilePath(textStudy);
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Texte non disponible (${res.status})`);
  const data = await res.json();

  const type = String(textStudy.type);

  // ── Tehilim ──────────────────────────────────────────────────────────────
  if (type === "Tehilim") {
    const psalmNum = String(textStudy.link).split(".").pop() ?? "1";
    const psalm = data[psalmNum] ?? { he: [], en: [] };
    return {
      title: textStudy.name,
      type,
      sections: [
        {
          index: 1,
          label: textStudy.name,
          he: normalizeLines(psalm.he),
          en: normalizeLines(psalm.en),
        },
      ],
    };
  }

  // ── Mishna ───────────────────────────────────────────────────────────────
  if (type === "Mishna") {
    const heChapters: unknown[] = data.he ?? [];
    const enChapters: unknown[] = data.en ?? [];
    const sections: TextSection[] = heChapters
      .map((ch: unknown, i: number) => ({
        index: i + 1,
        label: `Chapitre ${i + 1}`,
        he: normalizeLines(ch),
        en: normalizeLines(enChapters[i]),
      }))
      .filter((s) => s.he.length > 0);
    return { title: data.title ?? textStudy.name, type, sections };
  }

  // ── Talmud Bavli ─────────────────────────────────────────────────────────
  if (type === "Talmud Bavli") {
    const heDaf: unknown[] = data.he ?? [];
    const enDaf: unknown[] = data.en ?? [];
    const sections: TextSection[] = [];
    for (let i = 0; i < heDaf.length; i++) {
      const he = normalizeLines(heDaf[i]);
      if (he.length === 0) continue;
      sections.push({
        index: sections.length + 1,
        label: `Daf ${dafLabel(i)}`,
        he,
        en: normalizeLines(enDaf[i]),
      });
    }
    return { title: data.title ?? textStudy.name, type, sections };
  }

  // ── Tanakh ───────────────────────────────────────────────────────────────
  if (type === "Tanakh") {
    const heChapters: unknown[] = data.he ?? [];
    const enChapters: unknown[] = data.en ?? [];
    const sections: TextSection[] = heChapters
      .map((ch: unknown, i: number) => ({
        index: i + 1,
        label: `Chapitre ${i + 1}`,
        he: normalizeLines(ch),
        en: normalizeLines(enChapters[i]),
      }))
      .filter((s) => s.he.length > 0);
    return { title: data.title ?? textStudy.name, type, sections };
  }

  throw new Error(`Type non supporté: ${type}`);
}
