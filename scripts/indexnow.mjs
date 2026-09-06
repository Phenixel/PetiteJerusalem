/**
 * Submit the site's indexable URLs to IndexNow.
 *
 * IndexNow instantly notifies participating search engines (Bing, Yandex,
 * Seznam…) that URLs are new or updated, Bing also feeds ChatGPT's web search.
 * Google does NOT use IndexNow; for Google, submit the sitemap in Search Console
 * (see SEO.md).
 *
 * Ownership is proven by hosting the key at
 * `https://petite-jerusalem.fr/<KEY>.txt` (committed under public/).
 *
 * The URL list is read from the sitemaps the build just wrote into `dist/`
 * (sitemap.xml is an index, one file per page family): the sitemap is the
 * single source of truth, so the 1 200 Bibliothèque reading pages, which are
 * generated from the text files rather than declared in `seoPages.ts`, are
 * submitted too (they used to be left out). IndexNow accepts up to 10 000 URLs
 * per call.
 *
 * Run after a deploy:  node scripts/indexnow.mjs   (or: npm run indexnow)
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Public by design, this is hosted at /<KEY>.txt on the domain.
const KEY = "7928be0e14242cf92e167550affa3215";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const SITE_URL = "https://petite-jerusalem.fr";
const MAX_URLS = 10_000;

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

/** Les `<loc>` d'un fichier sitemap (urlset ou index). */
function locsOf(file) {
  const xml = readFileSync(file, "utf-8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

/** Toutes les URL de pages : l'index renvoie aux sitemaps, qui listent les pages. */
function collectUrls() {
  const index = join(dist, "sitemap.xml");
  if (!existsSync(index)) {
    throw new Error(`${index} introuvable : lancer npm run build d'abord.`);
  }
  const urls = new Set();
  for (const loc of locsOf(index)) {
    // Un index pointe vers des fichiers sitemap-*.xml ; un urlset liste des pages.
    if (loc.endsWith(".xml")) {
      const file = join(dist, loc.replace(`${SITE_URL}/`, ""));
      if (existsSync(file)) for (const u of locsOf(file)) urls.add(u);
    } else {
      urls.add(loc);
    }
  }
  return [...urls];
}

async function main() {
  const host = new URL(SITE_URL).host;
  const urlList = collectUrls();
  if (urlList.length > MAX_URLS) {
    console.warn(`[indexnow] ${urlList.length} URL(s), only the first ${MAX_URLS} are submitted.`);
    urlList.length = MAX_URLS;
  }

  const body = {
    host,
    key: KEY,
    keyLocation: `${SITE_URL}/${KEY}.txt`,
    urlList,
  };

  console.log(`[indexnow] submitting ${urlList.length} URL(s) for ${host}.`);

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  // 200 = accepted, 202 = accepted/validation pending. Anything else is a problem.
  console.log(`[indexnow] response: ${res.status} ${res.statusText}`);
  if (res.status !== 200 && res.status !== 202) {
    console.error(await res.text());
    process.exitCode = 1;
  } else {
    console.log("[indexnow] done.");
  }
}

main().catch((err) => {
  console.error(`[indexnow] ${err.message}`);
  process.exitCode = 1;
});
