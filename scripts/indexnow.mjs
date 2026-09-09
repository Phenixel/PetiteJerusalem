/**
 * Soumet les URL indexables du site à IndexNow.
 *
 * IndexNow prévient instantanément les moteurs participants (Bing, Yandex,
 * Seznam…) que des URL sont nouvelles ou modifiées ; Bing alimente aussi la
 * recherche web de ChatGPT. Google n'utilise PAS IndexNow : pour Google, on
 * soumet le sitemap dans la Search Console (voir SEO.md).
 *
 * La propriété est prouvée en hébergeant la clé à
 * `https://petite-jerusalem.fr/<CLÉ>.txt` (versionnée sous public/).
 *
 * La liste des URL est lue dans les sitemaps que le build vient d'écrire dans
 * `dist/` (sitemap.xml est un index, un fichier par famille de pages) : le
 * sitemap est la source unique de vérité, si bien que les 1 200 pages de
 * lecture de la Bibliothèque, générées à partir des fichiers de textes plutôt
 * que déclarées dans `seoPages.ts`, sont soumises elles aussi (elles étaient
 * oubliées auparavant). IndexNow accepte jusqu'à 10 000 URL par appel.
 *
 * À lancer après un déploiement :  node scripts/indexnow.mjs   (ou : npm run indexnow)
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
