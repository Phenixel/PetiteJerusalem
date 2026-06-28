/**
 * SEO reading pages for the whole "Bibliothèque" library, under keyword URLs:
 *   /bibliotheque/tehilim/{n}            (Psaume n)
 *   /bibliotheque/tanakh/{parasha}       (single section)
 *   /bibliotheque/michna/{traite}        (hub) + /bibliotheque/michna/{traite}/{chapitre}
 *   /bibliotheque/talmud/{traite}        (hub) + /bibliotheque/talmud/{traite}/{chapitre}
 *
 * One canonical URL per piece of content (no more /lire ↔ /bibliotheque duplication).
 * The body markup is built here so it is shared by BOTH the build-time prerender
 * (verses read from disk) and the runtime view (verses fetched), so a crawler
 * and a human get identical content. The big text files are passed in, never
 * imported here, so they never land in the SPA bundle.
 */
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import type { TextContent, TextSection } from "../services/textService";
import { tractateSlug, tractateFromLink } from "../services/textService";
import { transliterate, hasNiqqud } from "../services/hebrewTransliteration";

export const SITE_URL = "https://petite-jerusalem.fr";

export type Corpus = "tehilim" | "tanakh" | "michna" | "talmud";

const TYPE_TO_CORPUS: Record<string, Corpus> = {
  Tehilim: "tehilim",
  Tanakh: "tanakh",
  Mishna: "michna",
  "Talmud Bavli": "talmud",
};

const CORPUS_LABEL: Record<Corpus, string> = {
  tehilim: "Tehilim",
  tanakh: "Tanakh",
  michna: "Michna",
  talmud: "Talmud",
};

const allEntries = (textStudiesJson as TextStudiesJson).textStudies;

export const corpusOf = (entry: TextStudyJsonEntry): Corpus =>
  TYPE_TO_CORPUS[String(entry.type)];

/** Latin display name without the Hebrew prefix: "ברכות (Berakhot)" → "Berakhot". */
export function latinName(entry: TextStudyJsonEntry): string {
  const m = entry.name.match(/\(([^)]+)\)\s*$/);
  return (m ? m[1] : entry.name).trim();
}

/** Raw slug for an entry (psalm number for Tehilim, tractate/parasha slug otherwise). */
function baseSlug(entry: TextStudyJsonEntry): string {
  const corpus = corpusOf(entry);
  if (corpus === "tehilim") return String(entry.link).split(".").pop() ?? "1";
  if (corpus === "talmud") return tractateSlug(tractateFromLink(entry.link));
  if (corpus === "michna") return tractateSlug(tractateFromLink(entry.link, true));
  return tractateSlug(latinName(entry)); // tanakh parasha / book
}

/**
 * Globally-unique slug per entry. A few entries share a name (e.g. two Tanakh
 * "Shoftim"); we suffix later collisions deterministically (-2, -3…) by iterating
 * in the stable JSON order, so the same entry always gets the same URL.
 */
const slugByEntryId = new Map<number | string, string>();
{
  const usedByCorpus: Record<string, Set<string>> = {};
  for (const entry of allEntries) {
    const corpus = corpusOf(entry);
    if (!corpus) continue;
    const used = (usedByCorpus[corpus] ??= new Set());
    const base = baseSlug(entry);
    let slug = base;
    for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`;
    used.add(slug);
    slugByEntryId.set(entry.id, slug);
  }
}

export function slugOf(entry: TextStudyJsonEntry): string {
  return slugByEntryId.get(entry.id) ?? baseSlug(entry);
}

/** Multi-section entries (Talmud, Michna) get a hub + one page per chapter. */
export const isMultiSection = (entry: TextStudyJsonEntry): boolean =>
  (entry.totalSections ?? 1) > 1;

const ETUDE = "/bibliotheque";

export const hubPath = (entry: TextStudyJsonEntry): string =>
  `${ETUDE}/${corpusOf(entry)}/${slugOf(entry)}`;

/** Canonical path of a given section (hub path itself for single-section texts). */
export const sectionPath = (entry: TextStudyJsonEntry, sectionIndex: number): string =>
  isMultiSection(entry) ? `${hubPath(entry)}/${sectionIndex}` : hubPath(entry);

// ---- Resolution (corpus + slug → entry), for the runtime view + build --------

const byCorpusSlug = new Map<string, TextStudyJsonEntry>();
for (const entry of allEntries) {
  const corpus = corpusOf(entry);
  if (corpus) byCorpusSlug.set(`${corpus}/${slugOf(entry)}`, entry);
}

export const entryByCorpusSlug = (corpus: string, slug: string): TextStudyJsonEntry | null =>
  byCorpusSlug.get(`${corpus}/${slug}`) ?? null;

/** Entries of a corpus in reading order (Tehilim numerically, others as listed). */
function corpusEntries(corpus: Corpus): TextStudyJsonEntry[] {
  const list = allEntries.filter((e) => corpusOf(e) === corpus);
  if (corpus === "tehilim") list.sort((a, b) => Number(slugOf(a)) - Number(slugOf(b)));
  return list;
}

/** Reader URL of an entry (kept only for the in-session reader / legacy links). */
export const readerPath = (entry: TextStudyJsonEntry): string => `/lire/${entry.id}`;

// ---- HTML building -----------------------------------------------------------

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const SHARE_NEW_SESSION = "/share-reading/new-session";

/** Render lines as Hebrew + (where vocalized) French phonetic. */
function linesHtml(lines: string[], numbered: boolean): string {
  return lines
    .map((line, i) => {
      const tl = hasNiqqud(line) ? transliterate(line) : "";
      const num = numbered ? `<span class="verse-num">${i + 1}</span>\n        ` : "";
      const tlHtml = tl ? `\n        <span class="tl" lang="fr">${esc(tl)}</span>` : "";
      return (
        `<li>\n        ${num}<span class="he" lang="he" dir="rtl">${esc(line)}</span>` +
        `${tlHtml}\n      </li>`
      );
    })
    .join("\n      ");
}

/** Render a section's text (Talmud groups lines under daf sub-headers). */
function sectionTextHtml(section: TextSection, numbered: boolean): string {
  if (section.dafBlocks?.length) {
    return section.dafBlocks
      .map(
        (block) =>
          `<h3 class="daf-label">Daf ${esc(block.daf)}</h3>\n` +
          `      <ol class="reading-lines">\n      ${linesHtml(block.lines, false)}\n      </ol>`,
      )
      .join("\n      ");
  }
  return `<ol class="reading-lines">\n      ${linesHtml(section.he, numbered)}\n      </ol>`;
}

/** Short SEO intro reused by the prerender AND the live reader (top of page). */
export const READING_LEAD =
  "Texte intégral en hébreu, accompagné de la phonétique pour le lire même sans maîtriser l'hébreu. Lisez-le seul ou partagez-en la lecture à plusieurs.";

/** A short human title for a section, used in H1 / breadcrumbs. */
export function sectionHeading(entry: TextStudyJsonEntry, section: TextSection): string {
  const corpus = corpusOf(entry);
  if (corpus === "tehilim") return `Tehilim ${slugOf(entry)} — Psaume ${slugOf(entry)}`;
  if (corpus === "tanakh") return `Parashat ${latinName(entry)}`;
  return `${CORPUS_LABEL[corpus]} ${latinName(entry)} — ${section.label}`;
}

export function hubHeading(entry: TextStudyJsonEntry): string {
  return `${CORPUS_LABEL[corpusOf(entry)]} ${latinName(entry)}`;
}

// ---- Page metadata -----------------------------------------------------------

export function sectionTitle(entry: TextStudyJsonEntry, section: TextSection): string {
  const corpus = corpusOf(entry);
  if (corpus === "tehilim")
    return `Tehilim ${slugOf(entry)} en phonétique et en hébreu (Psaume ${slugOf(entry)}) | Petite Jérusalem`;
  if (corpus === "tanakh")
    return `Parashat ${latinName(entry)} en hébreu et phonétique | Petite Jérusalem`;
  return `${CORPUS_LABEL[corpus]} ${latinName(entry)} ${section.label} en hébreu et phonétique | Petite Jérusalem`;
}

export function sectionDescription(entry: TextStudyJsonEntry, section: TextSection): string {
  const corpus = corpusOf(entry);
  const what =
    corpus === "tehilim"
      ? `le Tehilim ${slugOf(entry)} (Psaume ${slugOf(entry)})`
      : corpus === "tanakh"
        ? `la parasha ${latinName(entry)}`
        : `${CORPUS_LABEL[corpus]} ${latinName(entry)}, ${section.label.toLowerCase()}`;
  return `Lisez ${what} en hébreu avec la phonétique pour le lire facilement. Texte intégral, navigation et partage de la lecture à plusieurs.`;
}

export function hubTitle(entry: TextStudyJsonEntry): string {
  return `${CORPUS_LABEL[corpusOf(entry)]} ${latinName(entry)} en ligne (hébreu + phonétique) | Petite Jérusalem`;
}

export function hubDescription(entry: TextStudyJsonEntry): string {
  return `Lisez ${CORPUS_LABEL[corpusOf(entry)]} ${latinName(entry)} en ligne, chapitre par chapitre, en hébreu avec la phonétique. Texte intégral et partage de la lecture à plusieurs.`;
}

// ---- Bodies ------------------------------------------------------------------

const ctaHtml = `<p><a class="seo-cta" href="${SHARE_NEW_SESSION}">Partager cette lecture à plusieurs</a></p>`;

function relatedLinksHtml(entry: TextStudyJsonEntry): string {
  const corpus = corpusOf(entry);
  const items: string[] = [];
  if (isMultiSection(entry))
    items.push(`<li><a href="${hubPath(entry)}">Tous les chapitres de ${latinName(entry)}</a></li>`);
  items.push(`<li><a href="/bibliotheque">Bibliothèque (Tehilim, Michna, Talmud, Tanakh)</a></li>`);
  if (corpus === "tehilim")
    items.push(`<li><a href="/tehilim">Tehilim par intention</a></li>`);
  return items.join("\n        ");
}

/** Build the body of a single reading page (one section). */
export function buildSectionBody(
  entry: TextStudyJsonEntry,
  content: TextContent,
  section: TextSection,
): string {
  const corpus = corpusOf(entry);
  const numbered = (entry.totalSections ?? 1) > 1 || corpus === "tanakh";

  // Prev/next: adjacent chapter within a multi-section text, else adjacent entry.
  let nav = "";
  if (isMultiSection(entry)) {
    const idx = content.sections.findIndex((s) => s.index === section.index);
    const prev = idx > 0 ? content.sections[idx - 1] : null;
    const next = idx >= 0 && idx < content.sections.length - 1 ? content.sections[idx + 1] : null;
    const prevHtml = prev
      ? `<a class="prev" href="${sectionPath(entry, prev.index)}">← ${esc(prev.label)}</a>`
      : "<span></span>";
    const nextHtml = next
      ? `<a class="next" href="${sectionPath(entry, next.index)}">${esc(next.label)} →</a>`
      : "<span></span>";
    nav = `${prevHtml}\n      ${nextHtml}`;
  } else {
    const siblings = corpusEntries(corpus);
    const idx = siblings.findIndex((e) => e.id === entry.id);
    const prev = idx > 0 ? siblings[idx - 1] : null;
    const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
    const prevHtml = prev
      ? `<a class="prev" href="${hubPath(prev)}">← ${esc(corpus === "tehilim" ? `Tehilim ${slugOf(prev)}` : latinName(prev))}</a>`
      : "<span></span>";
    const nextHtml = next
      ? `<a class="next" href="${hubPath(next)}">${esc(corpus === "tehilim" ? `Tehilim ${slugOf(next)}` : latinName(next))} →</a>`
      : "<span></span>";
    nav = `${prevHtml}\n      ${nextHtml}`;
  }

  return `
  <main class="seo-article reading-page">
    <h1>${esc(sectionHeading(entry, section))}</h1>
    <p class="seo-lead">${READING_LEAD}</p>

    ${ctaHtml}

    <section class="seo-section">
      ${sectionTextHtml(section, numbered)}
    </section>

    <nav class="reading-nav" aria-label="Navigation">
      ${nav}
    </nav>

    <section class="seo-section">
      <h2>Aller plus loin</h2>
      <ul>
        ${relatedLinksHtml(entry)}
      </ul>
    </section>
  </main>`;
}

/** Build the hub body of a multi-section text (chapter list). */
export function buildHubBody(entry: TextStudyJsonEntry, content: TextContent): string {
  const rows = content.sections
    .map(
      (s) =>
        `<li><a href="${sectionPath(entry, s.index)}">${esc(s.label)}</a></li>`,
    )
    .join("\n        ");
  return `
  <main class="seo-article reading-page">
    <h1>${esc(hubHeading(entry))}</h1>
    <p class="seo-lead">
      Lisez ${esc(CORPUS_LABEL[corpusOf(entry)])} ${esc(latinName(entry))} en ligne, chapitre par
      chapitre, en hébreu avec la phonétique.
    </p>

    ${ctaHtml}

    <section class="seo-section">
      <h2>Chapitres</h2>
      <ul class="chapter-list">
        ${rows}
      </ul>
    </section>

    <section class="seo-section">
      <h2>Aller plus loin</h2>
      <ul>
        <li><a href="/bibliotheque">Bibliothèque (Tehilim, Michna, Talmud, Tanakh)</a></li>
      </ul>
    </section>
  </main>`;
}

// ---- JSON-LD -----------------------------------------------------------------

function breadcrumb(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  };
}

export function sectionJsonLd(
  entry: TextStudyJsonEntry,
  section: TextSection,
): Record<string, unknown>[] {
  const corpus = corpusOf(entry);
  const trail = [
    { name: "Accueil", path: "/" },
    { name: "Bibliothèque", path: "/bibliotheque" },
  ];
  if (isMultiSection(entry)) trail.push({ name: latinName(entry), path: hubPath(entry) });
  trail.push({ name: sectionHeading(entry, section), path: sectionPath(entry, section.index) });
  return [
    breadcrumb(trail),
    {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      name: sectionHeading(entry, section),
      inLanguage: ["he", "fr"],
      isPartOf: { "@type": "CreativeWork", name: CORPUS_LABEL[corpus] },
      url: `${SITE_URL}${sectionPath(entry, section.index)}`,
    },
  ];
}

export function hubJsonLd(entry: TextStudyJsonEntry): Record<string, unknown>[] {
  return [
    breadcrumb([
      { name: "Accueil", path: "/" },
      { name: "Bibliothèque", path: "/bibliotheque" },
      { name: latinName(entry), path: hubPath(entry) },
    ]),
  ];
}

/** All study entries (used by the prerender to iterate every corpus). */
export const studyEntries = allEntries.filter((e) => Boolean(corpusOf(e)));
