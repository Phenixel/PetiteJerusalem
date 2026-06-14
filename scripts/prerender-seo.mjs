/**
 * Prerender SEO metadata for static routes.
 *
 * Petite Jérusalem is a Vue SPA served by Firebase Hosting. Social network
 * crawlers (WhatsApp, Facebook, Twitter/X, LinkedIn…) and many search bots do
 * NOT execute JavaScript, so they only ever read the static `index.html`. That
 * is why every shared link used to show the exact same preview text.
 *
 * To give each public, statically-known page its own preview, this script runs
 * after `vite build` and writes a dedicated HTML file per route (e.g.
 * `dist/share-reading.html`). With `cleanUrls: true` in firebase.json, a
 * request to `/share-reading` is served directly from that file, so the crawler
 * sees route-specific <title>, description and Open Graph / Twitter tags.
 *
 * Dynamic routes (individual sessions, chiourim, authors) are resolved from
 * Firestore at runtime and cannot be prerendered here; they keep using the
 * client-side `seoService` (which is enough for Google, but not for non-JS
 * crawlers). Giving those their own previews would require a server-side step
 * (e.g. a Firebase Function detecting crawlers) — see the PR description.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const SITE_URL = "https://petite-jerusalem.fr";

/**
 * Public, statically-known routes that benefit from their own social preview.
 * Keep the copy aligned with `src/locales/fr.ts` (the default language).
 * `file` is the output path inside `dist`, served thanks to `cleanUrls: true`.
 */
export const staticPages = [
  {
    file: "share-reading.html",
    path: "/share-reading",
    title: "Partage de lectures et d'études de Torah – Petite Jérusalem",
    description:
      "Découvrez et créez des sessions de partage de lectures et d'études de Torah. Réservez des textes, étudiez à plusieurs et avancez ensemble avec la communauté.",
  },
  {
    file: "chiourim.html",
    path: "/chiourim",
    title: "Chiourim – Cours et leçons de Torah – Petite Jérusalem",
    description:
      "Écoutez des chiourim : cours et leçons de Torah partagés par la communauté. Trouvez un cours par thème ou par rav sur Petite Jérusalem.",
  },
  {
    file: "login.html",
    path: "/login",
    title: "Connexion – Petite Jérusalem",
    description:
      "Connectez-vous pour créer des sessions de partage de lectures, réserver des textes et suivre vos études.",
    robots: "noindex, follow",
  },
];

/** Escape a value so it is safe inside a double-quoted HTML attribute. */
export function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function replaceTitle(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(title)}</title>`);
}

function replaceMetaContent(html, attr, value, content) {
  const re = new RegExp(
    `(<meta\\b[^>]*\\b${attr}="${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*\\bcontent=")[\\s\\S]*?(")`,
  );
  return html.replace(re, (_m, p1, p2) => `${p1}${escapeAttr(content)}${p2}`);
}

function replaceCanonical(html, href) {
  return html.replace(
    /(<link\b[^>]*rel="canonical"[^>]*href=")[^"]*(")/,
    (_m, p1, p2) => `${p1}${escapeAttr(href)}${p2}`,
  );
}

/**
 * Pure transform: takes the built `index.html` template and a page descriptor,
 * returns the route-specific HTML. Exported for unit testing.
 */
export function injectMeta(template, page) {
  const url = `${SITE_URL}${page.path}`;
  let html = template;

  html = replaceTitle(html, page.title);
  html = replaceMetaContent(html, "name", "description", page.description);
  html = replaceMetaContent(html, "property", "og:title", page.title);
  html = replaceMetaContent(html, "property", "og:description", page.description);
  html = replaceMetaContent(html, "property", "og:url", url);
  html = replaceMetaContent(html, "name", "twitter:title", page.title);
  html = replaceMetaContent(html, "name", "twitter:description", page.description);
  html = replaceCanonical(html, url);

  if (page.robots) {
    html = replaceMetaContent(html, "name", "robots", page.robots);
  }

  return html;
}

function main() {
  const dist = join(__dirname, "..", "dist");
  const template = readFileSync(join(dist, "index.html"), "utf-8");

  for (const page of staticPages) {
    const html = injectMeta(template, page);
    writeFileSync(join(dist, page.file), html, "utf-8");
    console.log(`[prerender-seo] ${page.path} -> dist/${page.file}`);
  }

  console.log(`[prerender-seo] Generated ${staticPages.length} page(s).`);
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main();
}
