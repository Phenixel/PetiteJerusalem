/**
 * Prerender SEO content for static routes.
 *
 * Petite Jérusalem is a Vue SPA served by Firebase Hosting. Search bots and
 * social crawlers (Bing, GPTBot, ClaudeBot, PerplexityBot, WhatsApp, Facebook…)
 * do NOT execute JavaScript, so they only ever read the static HTML. The built
 * `index.html` ships an empty `<div id="app"></div>`, so without this step a
 * crawler sees no title-specific metadata AND no body content at all.
 *
 * This script runs after `vite build`. For every page declared in
 * `src/content/seoPages.ts` it writes a dedicated HTML file into `dist/`
 * (e.g. `dist/share-reading.html`) containing route-specific `<head>` tags,
 * JSON-LD, AND real crawlable `<body>` content. With `cleanUrls: true` in
 * firebase.json, `/share-reading` is served straight from that file.
 *
 * It also writes:
 *  - `dist/app.html`: the bare SPA shell used as the catch-all rewrite target,
 *    so deep app routes (e.g. /profile) never flash the homepage content.
 *  - `dist/sitemap.xml`: regenerated from the same page list, always in sync.
 *
 * Truly dynamic routes (individual sessions, chiourim, authors) are resolved at
 * runtime by the `socialPreview` Firebase Function (see functions/src/index.ts).
 *
 * The page content lives in `src/content/seoPages.ts` (a typed, framework- and
 * environment-agnostic module) so the Vue app and this build step share one
 * source of truth. It is a TypeScript file, loaded here through `jiti`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const __dirname = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url);

const { allPages, renderPage, buildSitemap, SITE_URL } = await jiti.import(
  "../src/content/seoPages.ts",
);
const {
  studyEntries,
  isMultiSection,
  hubPath,
  sectionPath,
  buildHubBody,
  buildSectionBody,
  hubTitle,
  hubDescription,
  sectionTitle,
  sectionDescription,
  hubJsonLd,
  sectionJsonLd,
} = await jiti.import("../src/content/etudeTexts.ts");
const { parseContent, resolveFilePath } = await jiti.import("../src/services/textService.ts");

/** Read + parse a text file from `dist/texts`, memoized (Tehilim shares one file). */
function makeTextLoader(dist, talmudChapters) {
  const cache = new Map();
  return (entry) => {
    const rel = resolveFilePath(entry).replace(/^\//, ""); // "/texts/x.json" → "texts/x.json"
    if (!cache.has(rel)) {
      cache.set(rel, JSON.parse(readFileSync(join(dist, rel), "utf-8")));
    }
    return parseContent(entry, cache.get(rel), talmudChapters);
  };
}

function writePage(dist, template, { file, path, title, description, bodyHtml, jsonLd }) {
  const target = join(dist, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, renderPage(template, { file, path, title, description, bodyHtml, jsonLd }), "utf-8");
}

const fileFor = (path) => `${path.replace(/^\//, "")}.html`;

/**
 * Generate the public reading pages for the whole library (Tehilim, Tanakh,
 * Michna, Talmud) under /etude/<corpus>/<slug>[/<section>]. Returns their
 * sitemap entries. The big text files are read from disk here, never bundled.
 */
function generateEtudePages(dist, template) {
  const talmudChapters = JSON.parse(readFileSync(join(dist, "texts", "talmud-chapters.json"), "utf-8"));
  const loadEntry = makeTextLoader(dist, talmudChapters);
  const sitemap = [];

  for (const entry of studyEntries) {
    let content;
    try {
      content = loadEntry(entry);
    } catch {
      console.warn(`[prerender-seo] text file missing for "${entry.name}", skipped.`);
      continue;
    }
    if (!content.sections.length) continue;

    if (isMultiSection(entry)) {
      writePage(dist, template, {
        file: fileFor(hubPath(entry)),
        path: hubPath(entry),
        title: hubTitle(entry),
        description: hubDescription(entry),
        bodyHtml: buildHubBody(entry, content),
        jsonLd: hubJsonLd(entry),
      });
      sitemap.push({ path: hubPath(entry), priority: 0.5, changefreq: "yearly" });

      for (const section of content.sections) {
        const path = sectionPath(entry, section.index);
        writePage(dist, template, {
          file: fileFor(path),
          path,
          title: sectionTitle(entry, section),
          description: sectionDescription(entry, section),
          bodyHtml: buildSectionBody(entry, content, section),
          jsonLd: sectionJsonLd(entry, section),
        });
        sitemap.push({ path, priority: 0.5, changefreq: "yearly" });
      }
    } else {
      const section = content.sections[0];
      const path = hubPath(entry);
      writePage(dist, template, {
        file: fileFor(path),
        path,
        title: sectionTitle(entry, section),
        description: sectionDescription(entry, section),
        bodyHtml: buildSectionBody(entry, content, section),
        jsonLd: sectionJsonLd(entry, section),
      });
      sitemap.push({ path, priority: 0.6, changefreq: "yearly" });
    }
  }

  console.log(`[prerender-seo] Generated ${sitemap.length} Bibliothèque reading page(s).`);
  return sitemap;
}

function main() {
  const dist = join(__dirname, "..", "dist");
  const template = readFileSync(join(dist, "index.html"), "utf-8");

  // 1. Bare SPA shell for the catch-all rewrite (no page-specific body).
  writeFileSync(join(dist, "app.html"), template, "utf-8");

  // 2. One static HTML file per indexable page (body + head + JSON-LD).
  //    Some pages live in a subfolder (e.g. tehilim/refoua-chelema.html), so
  //    make sure the target directory exists before writing.
  for (const page of allPages) {
    const html = renderPage(template, page);
    const target = join(dist, page.file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, html, "utf-8");
    console.log(`[prerender-seo] ${page.path} -> dist/${page.file}`);
  }

  // 2b. Public reading pages for the whole library (Tehilim, Tanakh, Michna,
  //     Talmud), generated from the text files and added to the sitemap below.
  const readingEntries = generateEtudePages(dist, template);

  // 3. Sitemap, regenerated from the same lists so it can never drift.
  const lastmod = new Date().toISOString().slice(0, 10);
  writeFileSync(join(dist, "sitemap.xml"), buildSitemap(lastmod, readingEntries), "utf-8");

  const total = allPages.length + readingEntries.length;
  console.log(`[prerender-seo] Generated ${total} page(s) + app.html + sitemap.xml.`);
  console.log(`[prerender-seo] Canonical host: ${SITE_URL}`);
}

main();
