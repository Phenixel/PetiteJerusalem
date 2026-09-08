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

export type Corpus = "tehilim" | "tanakh" | "michna" | "talmud" | "slihot" | "brahot" | "sidour";

const TYPE_TO_CORPUS: Record<string, Corpus> = {
  Tehilim: "tehilim",
  Tanakh: "tanakh",
  Mishna: "michna",
  "Talmud Bavli": "talmud",
  Slihot: "slihot",
  Brahot: "brahot",
  Sidour: "sidour",
};

const CORPUS_LABEL: Record<Corpus, string> = {
  tehilim: "Tehilim",
  tanakh: "Tanakh",
  michna: "Michna",
  talmud: "Talmud",
  slihot: "Sli'hot",
  brahot: "Brahot",
  sidour: "Sidour",
};

/**
 * Corpus liturgiques (Sli'hot, Brahot, Sidour) : des textes qu'on lit, pas des
 * textes qu'on partage. Ils ne sont jamais proposés au partage de lecture, le
 * choix des sessions reste limité à EnumTypeTextStudy, et leurs pages
 * n'affichent ni l'appel au partage ni la phrase qui le promet.
 */
const LITURGY_CORPORA: ReadonlySet<Corpus> = new Set(["slihot", "brahot", "sidour"]);

export const isLiturgy = (entry: TextStudyJsonEntry): boolean =>
  LITURGY_CORPORA.has(corpusOf(entry));

export const isShareable = (entry: TextStudyJsonEntry): boolean => !isLiturgy(entry);

const allEntries = (textStudiesJson as TextStudiesJson).textStudies;

export const corpusOf = (entry: TextStudyJsonEntry): Corpus => TYPE_TO_CORPUS[String(entry.type)];

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

/** Torah entries are parashiot ; the rest of the Tanakh corpus is plain books.
 * Exporté : dailyCycles s'en sert pour retrouver la paracha de la semaine. */
export const TORAH_LIVRES = new Set(["Berechit", "Chemot", "Vayikra", "Bamidbar", "Devarim"]);
const isParasha = (entry: TextStudyJsonEntry): boolean =>
  corpusOf(entry) === "tanakh" && TORAH_LIVRES.has(entry.livre);

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

// ---- HTML building -----------------------------------------------------------

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const SHARE_NEW_SESSION = "/share-reading/new-session";

/** Render lines as Hebrew + (where vocalized) French phonetic.
 * `rubrics` : didascalies de tefila, en français, au-dessus de leur ligne. */
function linesHtml(lines: string[], numbered: boolean, rubrics: (string | null)[] = []): string {
  return lines
    .map((line, i) => {
      const tl = hasNiqqud(line) ? transliterate(line) : "";
      const num = numbered ? `<span class="verse-num">${i + 1}</span>\n        ` : "";
      const rubric = rubrics[i]
        ? `<span class="rubric" lang="fr">${esc(rubrics[i]!)}</span>\n        `
        : "";
      const tlHtml = tl ? `\n        <span class="tl" lang="fr">${esc(tl)}</span>` : "";
      return (
        `<li>\n        ${rubric}${num}<span class="he" lang="he" dir="rtl">${esc(line)}</span>` +
        `${tlHtml}\n      </li>`
      );
    })
    .join("\n      ");
}

/** Render a section's text (Talmud groups lines under daf sub-headers,
 * single-section Tanakh under chapter / montée sub-headers). */
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
  if (section.blocks?.length) {
    // Tefila : les blocs du fil principal n'ont pas de titre ; la page
    // statique, sans date, montre aussi les ajouts conditionnels (`when`),
    // et les didascalies en français, elles font partie du texte.
    return section.blocks
      .map((block) => {
        const title = block.labelText?.fr ?? block.label;
        const rubrics = (block.paragraphs ?? []).map((p) => p.rubric?.fr ?? null);
        return (
          (title ? `<h3 class="daf-label">${esc(title)}</h3>\n      ` : "") +
          `<ol class="reading-lines">\n      ${linesHtml(block.lines, numbered, rubrics)}\n      </ol>`
        );
      })
      .join("\n      ");
  }
  return `<ol class="reading-lines">\n      ${linesHtml(section.he, numbered)}\n      </ol>`;
}

/** Short SEO intro reused by the prerender AND the live reader (top of page). */
export const READING_LEAD =
  "Texte intégral en hébreu, accompagné de la phonétique pour le lire même sans maîtriser l'hébreu. Lisez-le seul ou partagez-en la lecture à plusieurs.";

/** Même intro sans la promesse de partage, pour les corpus liturgiques. */
const READING_LEAD_SOLO =
  "Texte intégral en hébreu, accompagné de la phonétique pour le lire même sans maîtriser l'hébreu.";

export const readingLead = (entry: TextStudyJsonEntry): string =>
  isShareable(entry) ? READING_LEAD : READING_LEAD_SOLO;

/** A short human title for a section, used in H1 / breadcrumbs. */
export function sectionHeading(entry: TextStudyJsonEntry, section: TextSection): string {
  const corpus = corpusOf(entry);
  if (corpus === "tehilim") return `Tehilim ${slugOf(entry)}, Psaume ${slugOf(entry)}`;
  if (corpus === "tanakh") {
    if (isParasha(entry)) return `Parashat ${latinName(entry)}`;
    return isMultiSection(entry) ? `${latinName(entry)}, ${section.label}` : latinName(entry);
  }
  // Liturgie : le nom seul, « Sli'hot Sli'hot » ou un libellé de section
  // n'apporteraient rien sur un texte unique.
  if (LITURGY_CORPORA.has(corpus)) return latinName(entry);
  return `${CORPUS_LABEL[corpus]} ${latinName(entry)}, ${section.label}`;
}

function hubHeading(entry: TextStudyJsonEntry): string {
  return `${CORPUS_LABEL[corpusOf(entry)]} ${latinName(entry)}`;
}

// ---- Page metadata -----------------------------------------------------------

export function sectionTitle(entry: TextStudyJsonEntry, section: TextSection): string {
  const corpus = corpusOf(entry);
  if (corpus === "tehilim")
    return `Tehilim ${slugOf(entry)} en phonétique et en hébreu (Psaume ${slugOf(entry)}) | Petite Jérusalem`;
  if (corpus === "tanakh") {
    if (isParasha(entry))
      return `Parashat ${latinName(entry)} en hébreu et phonétique | Petite Jérusalem`;
    const sec = isMultiSection(entry) ? ` ${section.label}` : "";
    return `${latinName(entry)}${sec} en hébreu et phonétique | Petite Jérusalem`;
  }
  if (LITURGY_CORPORA.has(corpus))
    return `${latinName(entry)} en hébreu et phonétique | Petite Jérusalem`;
  return `${CORPUS_LABEL[corpus]} ${latinName(entry)} ${section.label} en hébreu et phonétique | Petite Jérusalem`;
}

export function sectionDescription(entry: TextStudyJsonEntry, section: TextSection): string {
  const corpus = corpusOf(entry);
  const what =
    corpus === "tehilim"
      ? `le Tehilim ${slugOf(entry)} (Psaume ${slugOf(entry)})`
      : corpus === "tanakh"
        ? isParasha(entry)
          ? `la parasha ${latinName(entry)}`
          : isMultiSection(entry)
            ? `${latinName(entry)}, ${section.label.toLowerCase()}`
            : latinName(entry)
        : LITURGY_CORPORA.has(corpus)
          ? latinName(entry)
          : `${CORPUS_LABEL[corpus]} ${latinName(entry)}, ${section.label.toLowerCase()}`;
  return isShareable(entry)
    ? `Lisez ${what} en hébreu avec la phonétique pour le lire facilement. Texte intégral, navigation et partage de la lecture à plusieurs.`
    : `Lisez ${what} en hébreu avec la phonétique pour le lire facilement. Texte intégral, sur votre écran.`;
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
    items.push(
      `<li><a href="${hubPath(entry)}">Tous les chapitres de ${latinName(entry)}</a></li>`,
    );
  if (LISTED_CORPORA.includes(corpus))
    items.push(`<li><a href="${corpusPath(corpus)}">${esc(CORPUS_SEO[corpus].listLabel)}</a></li>`);
  items.push(`<li><a href="/bibliotheque">Bibliothèque (Tehilim, Michna, Talmud, Tanakh)</a></li>`);
  if (corpus === "tehilim") items.push(`<li><a href="/tehilim">Tehilim par intention</a></li>`);
  return items.join("\n        ");
}

/** Build the body of a single reading page (one section). */
export function buildSectionBody(
  entry: TextStudyJsonEntry,
  content: TextContent,
  section: TextSection,
  /**
   * Encart HTML posé sous le chapeau : le prérendu y met la date de lecture
   * d'une paracha (voir parashaSeoPages.ts), qui demande hebcal et n'a donc
   * pas sa place dans ce module, chargé par les vues.
   */
  note = "",
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
  } else if (!isLiturgy(entry)) {
    // Pas de précédent/suivant sur la liturgie : les brahot ne se suivent pas.
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
    <p class="seo-lead">${readingLead(entry)}</p>
    ${note}

    ${isShareable(entry) ? ctaHtml : ""}

    <section class="seo-section">
      ${sectionTextHtml(section, numbered)}
    </section>

    ${nav ? `<nav class="reading-nav" aria-label="Navigation">\n      ${nav}\n    </nav>` : ""}

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
    .map((s) => `<li><a href="${sectionPath(entry, s.index)}">${esc(s.label)}</a></li>`)
    .join("\n        ");
  return `
  <main class="seo-article reading-page">
    <h1>${esc(hubHeading(entry))}</h1>
    <p class="seo-lead">
      Lisez ${esc(CORPUS_LABEL[corpusOf(entry)])} ${esc(latinName(entry))} en ligne, chapitre par
      chapitre, en hébreu avec la phonétique.
    </p>

    ${isShareable(entry) ? ctaHtml : ""}

    <section class="seo-section">
      <h2>Chapitres</h2>
      <ul class="chapter-list">
        ${rows}
      </ul>
    </section>

    <section class="seo-section">
      <h2>Aller plus loin</h2>
      <ul>
        <li><a href="${corpusPath(corpusOf(entry))}">${esc(CORPUS_SEO[corpusOf(entry)].listLabel)}</a></li>
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

// ---- Pages de corpus (/bibliotheque/<corpus>) ------------------------------
//
// La liste des livres d'un corpus n'existait que dans la vue (StudyPage) : un
// robot sans JavaScript recevait la coquille vide, et les ~1 200 pages de
// lecture n'étaient reliées entre elles que par le sitemap et leurs voisines.
// Les brahot et le sidour, eux, n'avaient aucun lien entrant. Une page
// statique par corpus, avec chaque livre en lien, donne aux moteurs le chemin
// accueil → bibliothèque → corpus → livre → chapitre.

export const corpusPath = (corpus: Corpus): string => `${ETUDE}/${corpus}`;

/**
 * Les corpus qui ont une page de liste. Les Sli'hot n'ont qu'un texte : leur
 * adresse redirige dessus (voir router/routes.ts), pas de liste à rendre.
 */
export const LISTED_CORPORA: Corpus[] = [
  "tehilim",
  "michna",
  "talmud",
  "tanakh",
  "sidour",
  "brahot",
];

type CorpusSeo = {
  title: string;
  description: string;
  h1: string;
  lead: string;
  /** Le libellé du lien vers la liste, depuis une page de lecture. */
  listLabel: string;
};

const CORPUS_SEO: Record<Corpus, CorpusSeo> = {
  tehilim: {
    title: "Les 150 Tehilim (Psaumes) en hébreu et phonétique | Petite Jérusalem",
    description:
      "Le livre des Tehilim en ligne : les 150 psaumes, chacun sur sa page, en hébreu avec la phonétique. À lire seul, selon le jour du mois, ou à partager à plusieurs pour une refoua chelema.",
    h1: "Tehilim : les 150 Psaumes en ligne",
    lead: "Le sefer Tehilim complet, psaume par psaume, en hébreu avec la phonétique pour le lire même sans maîtriser l'hébreu. Chaque psaume a sa page ; les cinq livres (sefarim) suivent l'ordre du texte.",
    listLabel: "Tous les Tehilim (150 psaumes)",
  },
  michna: {
    title: "La Michna en ligne, traité par traité | Petite Jérusalem",
    description:
      "Les six ordres (sedarim) de la Michna en ligne : chaque traité (massekhet) chapitre par chapitre, en hébreu avec la phonétique, à lire seul ou à répartir entre plusieurs personnes.",
    h1: "La Michna en ligne : les six sedarim",
    lead: "Zeraim, Moed, Nashim, Nezikin, Kodashim, Toharot : les traités de la Michna, chapitre par chapitre, en hébreu avec la phonétique.",
    listLabel: "Tous les traités de la Michna",
  },
  talmud: {
    title: "Le Talmud Bavli en ligne, traité par traité | Petite Jérusalem",
    description:
      "Les traités (massekhtot) du Talmud de Babylone en ligne, chapitre par chapitre, en hébreu avec la phonétique. Répartissez les dapim entre plusieurs personnes pour finir le Chass ensemble.",
    h1: "Le Talmud Bavli en ligne : les traités",
    lead: "La Guemara, traité par traité et chapitre par chapitre, en hébreu avec la phonétique. C'est aussi le point de départ pour se répartir le Chass à plusieurs jusqu'au siyoum.",
    listLabel: "Tous les traités du Talmud",
  },
  tanakh: {
    title: "Le Tanakh en ligne : Torah, Neviim et Ketouvim | Petite Jérusalem",
    description:
      "Le Tanakh en ligne : la Torah paracha par paracha, les Neviim (Prophètes) et les Ketouvim (Écrits), en hébreu avec la phonétique, texte intégral.",
    h1: "Le Tanakh en ligne : Torah, Neviim, Ketouvim",
    lead: "Les 54 parachiot de la Torah, puis les livres des Prophètes et des Écrits, en hébreu avec la phonétique.",
    listLabel: "Tout le Tanakh (parachiot et livres)",
  },
  sidour: {
    title: "Le Sidour en ligne : Cha'harit, Min'ha, Arvit | Petite Jérusalem",
    description:
      "Les prières de la semaine en ligne, en hébreu avec la phonétique : Cha'harit, Min'ha et Arvit, le Chema du coucher, le tikoun hatsot et la havdala.",
    h1: "Le Sidour en ligne",
    lead: "Les prières de la semaine, en hébreu avec la phonétique, chacune sur sa page.",
    listLabel: "Tout le Sidour",
  },
  slihot: {
    title: "Les Sli'hot en hébreu et phonétique | Petite Jérusalem",
    description:
      "Les Sli'hot du rite séfarade, en hébreu et en phonétique, pour Eloul et les dix jours de techouva.",
    h1: "Les Sli'hot",
    lead: "Les Sli'hot du rite séfarade, en hébreu avec la phonétique.",
    listLabel: "Les Sli'hot",
  },
  brahot: {
    title: "Les brahot (bénédictions) en hébreu et phonétique | Petite Jérusalem",
    description:
      "Les bénédictions en ligne, en hébreu avec la phonétique : Birkat Hamazon, brakha a'harona, bénédictions sur ce qu'on mange, prière du voyageur, allumage de Hanouka, brit mila, cheva brahot.",
    h1: "Les brahot : les bénédictions en ligne",
    lead: "Chaque bénédiction sur sa page, en hébreu avec la phonétique : les brahot de tous les jours, celles du cycle de la vie, des mitsvot et des fêtes.",
    listLabel: "Toutes les brahot",
  },
};

export const corpusTitle = (corpus: Corpus): string => CORPUS_SEO[corpus].title;
export const corpusDescription = (corpus: Corpus): string => CORPUS_SEO[corpus].description;

/** Le nom latin d'un livre ou d'un ordre : « זרעים (Zeraim) » → « Zeraim ». */
function latinLivre(livre: string): string {
  const m = livre.match(/\(([^)]+)\)\s*$/);
  return (m ? m[1] : livre).trim();
}

/** Le libellé d'un livre dans la liste de son corpus. */
function corpusItemLabel(entry: TextStudyJsonEntry): string {
  return corpusOf(entry) === "tehilim" ? `Tehilim ${slugOf(entry)}` : latinName(entry);
}

/** Les livres d'un corpus, groupés par ordre ou par sefer, dans l'ordre du texte. */
function corpusGroups(corpus: Corpus): { label: string; entries: TextStudyJsonEntry[] }[] {
  const groups = new Map<string, TextStudyJsonEntry[]>();
  for (const entry of corpusEntries(corpus)) {
    const key = latinLivre(entry.livre);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...groups].map(([label, entries]) => ({ label, entries }));
}

/** Le corps de la page d'un corpus : ses livres, chacun en lien. */
export function buildCorpusBody(corpus: Corpus): string {
  const seo = CORPUS_SEO[corpus];
  const groups = corpusGroups(corpus);
  const single = groups.length === 1;
  const sections = groups
    .map(({ label, entries }) => {
      const rows = entries
        .map((e) => `<li><a href="${hubPath(e)}">${esc(corpusItemLabel(e))}</a></li>`)
        .join("\n        ");
      return `<section class="seo-section">
      ${single ? "" : `<h2>${esc(label)}</h2>`}
      <ul class="chapter-list">
        ${rows}
      </ul>
    </section>`;
    })
    .join("\n\n    ");

  const others = LISTED_CORPORA.filter((c) => c !== corpus)
    .map((c) => `<li><a href="${corpusPath(c)}">${esc(CORPUS_SEO[c].listLabel)}</a></li>`)
    .join("\n        ");
  const extra =
    corpus === "tehilim"
      ? `<li><a href="/tehilim">Quels Tehilim lire selon l'intention</a></li>
        <li><a href="/partage-tehilim">Partager les Tehilim à plusieurs</a></li>`
      : corpus === "talmud"
        ? `<li><a href="/finir-le-chass">Finir le Chass à plusieurs</a></li>`
        : corpus === "tanakh"
          ? `<li><a href="/paracha">La paracha de la semaine</a></li>`
          : "";
  const shareable = !LITURGY_CORPORA.has(corpus);

  return `
  <main class="seo-article reading-page">
    <h1>${esc(seo.h1)}</h1>
    <p class="seo-lead">${esc(seo.lead)}</p>

    ${shareable ? ctaHtml : ""}

    ${sections}

    <section class="seo-section">
      <h2>Aller plus loin</h2>
      <ul>
        ${extra}
        ${others}
        <li><a href="/bibliotheque">Bibliothèque (Tehilim, Michna, Talmud, Tanakh)</a></li>
      </ul>
    </section>
  </main>`;
}

export function corpusJsonLd(corpus: Corpus): Record<string, unknown>[] {
  return [
    breadcrumb([
      { name: "Accueil", path: "/" },
      { name: "Bibliothèque", path: "/bibliotheque" },
      { name: CORPUS_LABEL[corpus], path: corpusPath(corpus) },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: CORPUS_SEO[corpus].h1,
      itemListElement: corpusEntries(corpus).map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: corpusItemLabel(e),
        url: `${SITE_URL}${hubPath(e)}`,
      })),
    },
  ];
}

/** All study entries (used by the prerender to iterate every corpus). */
export const studyEntries = allEntries.filter((e) => Boolean(corpusOf(e)));
