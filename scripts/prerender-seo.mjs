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
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const __dirname = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url);

const { allPages, renderPage, buildSitemap, SITE_URL } = await jiti.import(
  "../src/content/seoPages.ts",
);

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

  // 3. Sitemap, regenerated from the same list so it can never drift.
  const lastmod = new Date().toISOString().slice(0, 10);
  writeFileSync(join(dist, "sitemap.xml"), buildSitemap(lastmod), "utf-8");

  console.log(`[prerender-seo] Generated ${allPages.length} page(s) + app.html + sitemap.xml.`);
  console.log(`[prerender-seo] Canonical host: ${SITE_URL}`);
}

main();
