/**
 * Submit the site's indexable URLs to IndexNow.
 *
 * IndexNow instantly notifies participating search engines (Bing, Yandex,
 * Seznam…) that URLs are new or updated — Bing also feeds ChatGPT's web search.
 * Google does NOT use IndexNow; for Google, submit the sitemap in Search Console
 * (see SEO.md).
 *
 * Ownership is proven by hosting the key at
 * `https://petite-jerusalem.fr/<KEY>.txt` (committed under public/). The URL
 * list is derived from the same page list as the sitemap, so it never drifts.
 *
 * Run after a deploy:  node scripts/indexnow.mjs   (or: npm run indexnow)
 */
import { createJiti } from "jiti";

// Public by design — this is hosted at /<KEY>.txt on the domain.
const KEY = "7928be0e14242cf92e167550affa3215";
const ENDPOINT = "https://api.indexnow.org/indexnow";

const jiti = createJiti(import.meta.url);
const { allPages, SITE_URL } = await jiti.import("../src/content/seoPages.ts");

const host = new URL(SITE_URL).host;
const urlList = allPages
  .filter((p) => p.sitemap !== false)
  .map((p) => `${SITE_URL}${p.path}`);

async function main() {
  const body = {
    host,
    key: KEY,
    keyLocation: `${SITE_URL}/${KEY}.txt`,
    urlList,
  };

  console.log(`[indexnow] submitting ${urlList.length} URL(s) to ${host}:`);
  urlList.forEach((u) => console.log(`  ${u}`));

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

main();
