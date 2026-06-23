/**
 * Content for the individual Tehilim (Psalm) pages, e.g. /etude/tehilim/121.
 *
 * These long-tail SEO pages show a chapter's full Hebrew text plus a French
 * phonetic transliteration ("tehilim 121 en phonétique / en français" is a very
 * searched query). The body markup is built here so it is shared by BOTH:
 *  - `scripts/prerender-seo.mjs` (build time, verses read from the JSON file),
 *  - `src/views/TehilimChapterPage.vue` (runtime, verses fetched from
 *    `/texts/tehilim.json`).
 * so a crawler and a human visitor get identical content.
 *
 * Keep this module free of browser- or Node-only APIs: the big text file is
 * passed in by the caller, never imported here, so it never lands in the SPA
 * bundle.
 */
import { transliterate } from "../services/hebrewTransliteration";

const SITE_URL = "https://petite-jerusalem.fr";
const SITE_NAME = "Petite Jérusalem";

export const TEHILIM_CHAPTER_COUNT = 150;

/** Reader URL for the full chapter (Tehilim N is textId 102 + N). */
const readerHref = (n: number): string => `/lire/${102 + n}`;

export const chapterPath = (n: number): string => `/etude/tehilim/${n}`;

export const isValidChapter = (n: number): boolean =>
  Number.isInteger(n) && n >= 1 && n <= TEHILIM_CHAPTER_COUNT;

export const chapterTitle = (n: number): string =>
  `Tehilim ${n} en phonétique et en hébreu (Psaume ${n}) | ${SITE_NAME}`;

export const chapterDescription = (n: number): string =>
  `Lisez le Tehilim ${n} (Psaume ${n}) en hébreu avec sa phonétique pour le lire facilement. ` +
  `Texte intégral, navigation chapitre par chapitre et partage de la lecture à plusieurs.`;

/** Strip editorial markers / entities so the verse is clean for display + transliteration. */
function cleanVerse(raw: string): string {
  return raw
    .replace(/&thinsp;|&nbsp;/g, " ")
    .replace(/\{[^}]*\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Escape text for safe inclusion in HTML (verses contain no markup of their own). */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function versesHtml(verses: string[]): string {
  return verses
    .map((raw, i) => {
      const he = cleanVerse(raw);
      const tl = transliterate(he);
      return (
        `<li>\n` +
        `        <span class="verse-num">${i + 1}</span>\n` +
        `        <span class="he" lang="he" dir="rtl">${esc(he)}</span>\n` +
        `        <span class="tl" lang="fr">${esc(tl)}</span>\n` +
        `      </li>`
      );
    })
    .join("\n      ");
}

/** Build the crawlable body for a chapter page. `verses` is the chapter's `he` array. */
export function buildChapterBody(n: number, verses: string[]): string {
  const prev =
    n > 1
      ? `<a class="prev" href="${chapterPath(n - 1)}">← Tehilim ${n - 1}</a>`
      : `<span></span>`;
  const next =
    n < TEHILIM_CHAPTER_COUNT
      ? `<a class="next" href="${chapterPath(n + 1)}">Tehilim ${n + 1} →</a>`
      : `<span></span>`;

  return `
  <main class="seo-article tehilim-chapter">
    <h1>Tehilim ${n} — Psaume ${n}</h1>
    <p class="seo-lead">
      Le texte intégral du Tehilim ${n} (Psaume ${n}) en hébreu, accompagné de la phonétique
      pour le lire même sans maîtriser l'hébreu. Lisez-le seul ou partagez-en la lecture à plusieurs.
    </p>

    <p><a class="seo-cta" href="/share-reading/new-session">Partager la lecture des Tehilim</a></p>

    <section class="seo-section">
      <ol class="tehilim-verses">
      ${versesHtml(verses)}
      </ol>
      <p class="seo-note">
        <em>Phonétique générée automatiquement comme aide à la lecture&nbsp;; elle peut comporter
        des approximations. La traduction française sera ajoutée prochainement.</em>
      </p>
    </section>

    <nav class="tehilim-nav" aria-label="Navigation entre les psaumes">
      ${prev}
      ${next}
    </nav>

    <section class="seo-section">
      <h2>Aller plus loin</h2>
      <ul>
        <li><a href="${readerHref(n)}">Lire le Tehilim ${n} dans le lecteur</a></li>
        <li><a href="/partage-tehilim">Partager les Tehilim à plusieurs</a></li>
        <li><a href="/etude">Étude libre des textes</a></li>
      </ul>
    </section>
  </main>`;
}

/** schema.org JSON-LD for a chapter page (breadcrumb + the text as CreativeWork). */
export function chapterJsonLd(n: number): Record<string, unknown>[] {
  const path = chapterPath(n);
  return [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Étude", item: `${SITE_URL}/etude` },
        { "@type": "ListItem", position: 3, name: `Tehilim ${n}`, item: `${SITE_URL}${path}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      name: `Tehilim ${n} (Psaume ${n})`,
      inLanguage: ["he", "fr"],
      isPartOf: { "@type": "CreativeWork", name: "Tehilim (Psaumes)" },
      url: `${SITE_URL}${path}`,
    },
  ];
}
