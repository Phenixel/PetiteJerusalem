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
  TEHILIM_CHAPTER_COUNT,
  chapterPath,
  chapterTitle,
  chapterDescription,
  buildChapterBody,
  chapterJsonLd,
} = await jiti.import("../src/content/tehilimChapter.ts");

/**
 * Generate the individual Tehilim chapter pages (/etude/tehilim/N) from the
 * local text file. Returns their sitemap entries so they can be appended to
 * sitemap.xml. Kept out of `allPages` so the full Hebrew text never lands in
 * the SPA bundle.
 */
function generateTehilimChapters(dist, template) {
  const text = JSON.parse(readFileSync(join(dist, "texts", "tehilim.json"), "utf-8"));
  const dir = join(dist, "etude", "tehilim");
  mkdirSync(dir, { recursive: true });

  const entries = [];
  for (let n = 1; n <= TEHILIM_CHAPTER_COUNT; n++) {
    const verses = text[String(n)]?.he;
    if (!verses) {
      console.warn(`[prerender-seo] Tehilim ${n} missing from tehilim.json, skipped.`);
      continue;
    }
    const page = {
      file: `etude/tehilim/${n}.html`,
      path: chapterPath(n),
      title: chapterTitle(n),
      description: chapterDescription(n),
      bodyHtml: buildChapterBody(n, verses),
      jsonLd: chapterJsonLd(n),
    };
    writeFileSync(join(dist, page.file), renderPage(template, page), "utf-8");
    entries.push({ path: page.path, priority: 0.5, changefreq: "yearly" });
  }
  console.log(`[prerender-seo] Generated ${entries.length} Tehilim chapter page(s).`);
  return entries;
}

function main() {
  const dist = join(__dirname, "..", "dist");
  const template = readFileSync(join(dist, "index.html"), "utf-8");

  // 1. Bare SPA shell for the catch-all rewrite (no page-specific body).
  writeFileSync(join(dist, "app.html"), template, "utf-8");

  // 2. One static HTML file per indexable page (body + head + JSON-LD).
  for (const page of allPages) {
    const html = renderPage(template, page);
    writeFileSync(join(dist, page.file), html, "utf-8");
    console.log(`[prerender-seo] ${page.path} -> dist/${page.file}`);
  }

  // 2b. Individual Tehilim chapter pages (long-tail SEO), generated from the
  //     text file and added to the sitemap below.
  const chapterEntries = generateTehilimChapters(dist, template);

  // 3. Sitemap, regenerated from the same lists so it can never drift.
  const lastmod = new Date().toISOString().slice(0, 10);
  writeFileSync(join(dist, "sitemap.xml"), buildSitemap(lastmod, chapterEntries), "utf-8");

  const total = allPages.length + chapterEntries.length;
  console.log(`[prerender-seo] Generated ${total} page(s) + app.html + sitemap.xml.`);
  console.log(`[prerender-seo] Canonical host: ${SITE_URL}`);
}

main();
