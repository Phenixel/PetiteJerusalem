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
 *  - `dist/sitemap.xml`: an index of one sitemap per page family
 *    (sitemap-pages.xml, sitemap-bibliotheque.xml, sitemap-horaires.xml,
 *    sitemap-calendrier.xml), regenerated from the same page lists, always
 *    in sync. Each URL carries the real date of its content (git), see
 *    scripts/lib/lastmod.mjs; the computed pages carry the build date.
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
import { makeLastmod } from "./lib/lastmod.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url);

const {
  allPages,
  renderPage,
  sitemapEntriesOfPages,
  buildSitemapFile,
  buildSitemapIndex,
  buildAppShell,
  SITE_URL,
} = await jiti.import("../src/content/seoPages.ts");
const { isSectionPath } = await jiti.import("../src/content/seoLocales.ts");
const { buildZmanimSeoPages } = await jiti.import("../src/content/zmanimSeoPages.ts");
const { buildParashaSeoPages, parashaNotes } = await jiti.import(
  "../src/content/parashaSeoPages.ts",
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
  LISTED_CORPORA,
  corpusPath,
  corpusTitle,
  corpusDescription,
  buildCorpusBody,
  corpusJsonLd,
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

// La page est passée entière : `locale` et `alternates` décident du lang, du
// dir et des hreflang du document, et se perdraient dans une destructuration.
function writePage(dist, template, page) {
  const target = join(dist, page.file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, renderPage(template, page), "utf-8");
}

const fileFor = (path) => `${path.replace(/^\//, "")}.html`;

/**
 * Le texte d'une page, sans balises : titres en tête de ligne, listes à
 * puces, entités décodées. Sert à llms-full.txt, la version texte des pages
 * principales que les assistants d'IA lisent d'un trait.
 */
function htmlToText(html) {
  return (
    html
      .replace(/<script[\s\S]*?<\/script>/g, "")
      .replace(/<h1[^>]*>/g, "\n# ")
      .replace(/<h2[^>]*>/g, "\n## ")
      .replace(/<h3[^>]*>/g, "\n### ")
      .replace(/<(li|dt)[^>]*>/g, "\n- ")
      .replace(/<tr[^>]*>/g, "\n")
      .replace(/<\/(td|th)>/g, " | ")
      .replace(/<\/(p|li|dd|dt|h\d|tr|section|div|table|ul|ol|dl|main|nav|footer)>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      // Une puce vide (un <li> qui ne contenait qu'un titre) n'apporte rien.
      .replace(/\n-\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * llms-full.txt : les pages principales du site en un seul texte (accueil,
 * pages d'atterrissage, guides, Tehilim par intention, horaires de Paris,
 * calendrier et fêtes, paracha), en français, chacune sous son URL. C'est le
 * pendant « intégral » de llms.txt : un assistant qui ne lit qu'un fichier y
 * trouve les réponses (dates des fêtes, comment finir le Chass, quels
 * Tehilim pour quelle intention) sans crawler le site. Les 1 200 pages de
 * lecture n'y sont pas : elles pèseraient des dizaines de mégaoctets.
 */
function buildLlmsFull(pages, today) {
  const head = [
    "# Petite Jérusalem",
    "",
    `> Version texte des pages principales de ${SITE_URL}, générée le ${today}. ` +
      "Le sommaire et les mots-clés sont dans /llms.txt ; toutes les URL dans /sitemap.xml.",
    "",
  ];
  const body = pages.map((page) => {
    const text = htmlToText(page.bodyHtml).replace(/^# [^\n]*\n/, "");
    return `\n---\n\n# ${page.title}\n\nURL : ${SITE_URL}${page.path}\n\n${page.description}\n\n${text}`;
  });
  return `${head.join("\n")}${body.join("\n")}\n`;
}

/**
 * Generate the public reading pages for the whole library (Tehilim, Tanakh,
 * Michna, Talmud) under /etude/<corpus>/<slug>[/<section>]. Returns their
 * sitemap entries. The big text files are read from disk here, never bundled.
 */
function generateEtudePages(dist, template, lastmodOf) {
  const talmudChapters = JSON.parse(
    readFileSync(join(dist, "texts", "talmud-chapters.json"), "utf-8"),
  );
  const loadEntry = makeTextLoader(dist, talmudChapters);
  const sitemap = [];
  // Quand chaque paracha se lit : une phrase datée sur sa page de texte, sans
  // quoi « quand lit-on Ki Tétsé » ne trouve rien alors que la page existe.
  const notes = parashaNotes();

  for (const entry of studyEntries) {
    let content;
    try {
      content = loadEntry(entry);
    } catch {
      console.warn(`[prerender-seo] text file missing for "${entry.name}", skipped.`);
      continue;
    }
    if (!content.sections.length) continue;
    // La page change quand son texte ou son gabarit change, pas à chaque build.
    const lastmod = lastmodOf([
      `public${resolveFilePath(entry)}`,
      "src/content/etudeTexts.ts",
      "src/datas/textStudies.json",
    ]);

    if (isMultiSection(entry)) {
      writePage(dist, template, {
        file: fileFor(hubPath(entry)),
        path: hubPath(entry),
        title: hubTitle(entry),
        description: hubDescription(entry),
        bodyHtml: buildHubBody(entry, content),
        jsonLd: hubJsonLd(entry),
      });
      sitemap.push({ path: hubPath(entry), priority: 0.5, changefreq: "yearly", lastmod });

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
        sitemap.push({ path, priority: 0.5, changefreq: "yearly", lastmod });
      }
    } else {
      const section = content.sections[0];
      const path = hubPath(entry);
      writePage(dist, template, {
        file: fileFor(path),
        path,
        title: sectionTitle(entry, section),
        description: sectionDescription(entry, section),
        bodyHtml: buildSectionBody(entry, content, section, notes.get(String(entry.id)) ?? ""),
        jsonLd: sectionJsonLd(entry, section),
      });
      // Les parachiot portent une phrase datée (parashaNotes) qui suit le
      // calendrier : leur page change réellement d'un build à l'autre.
      sitemap.push({
        path,
        priority: 0.6,
        changefreq: "yearly",
        lastmod: notes.has(String(entry.id)) ? undefined : lastmod,
      });
    }
  }

  // La page de chaque corpus (/bibliotheque/talmud…) : la liste de ses livres,
  // chacun en lien. Sans elle, un robot n'avait aucun chemin de la
  // bibliothèque vers les pages de lecture (la liste ne vivait que dans Vue).
  const corpusDate = lastmodOf(["src/content/etudeTexts.ts", "src/datas/textStudies.json"]);
  for (const corpus of LISTED_CORPORA) {
    const path = corpusPath(corpus);
    writePage(dist, template, {
      file: fileFor(path),
      path,
      title: corpusTitle(corpus),
      description: corpusDescription(corpus),
      bodyHtml: buildCorpusBody(corpus),
      jsonLd: corpusJsonLd(corpus),
    });
    sitemap.push({ path, priority: 0.7, changefreq: "monthly", lastmod: corpusDate });
  }

  console.log(
    `[prerender-seo] Generated ${sitemap.length} Bibliothèque page(s) (${LISTED_CORPORA.length} corpus lists).`,
  );
  return sitemap;
}

function main() {
  const dist = join(__dirname, "..", "dist");
  const template = readFileSync(join(dist, "index.html"), "utf-8");
  const today = new Date().toISOString().slice(0, 10);

  // Les dates de dernière modification, lues de git : les pages de contenu
  // datent de leur dernier commit, les pages calculées (horaires, calendrier,
  // paracha) du jour du build. Sans historique, tout date du build.
  const { lastmodOf, known } = makeLastmod(
    ["public/texts", "src/content", "src/datas"],
    today,
    join(__dirname, ".."),
  );
  if (!known) {
    console.warn(
      "[prerender-seo] historique git indisponible (clone superficiel ?) : lastmod = date du build.",
    );
  }
  const contentDate = lastmodOf([
    "src/content/seoPages.ts",
    "src/content/seoLocales.ts",
    "src/content/zmanimGuideStrings.ts",
  ]);

  // 1. Bare SPA shell for the catch-all rewrite (no page-specific body).
  //    Canonical + og:url are stripped: the shell serves every deep route
  //    (/profile, /share-reading/new-session…) and must not declare each of
  //    them a duplicate of the homepage (Search Console "Duplicate page").
  //    The views set the right canonical on mount (seoService).
  writeFileSync(join(dist, "app.html"), buildAppShell(template), "utf-8");

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
  const readingEntries = generateEtudePages(dist, template, lastmodOf);

  // 2c. Horaires de Chabbat (/horaires) + calendrier des fêtes (/calendrier) :
  //     content computed at build time (hebcal), so it lives in its own module
  //     (src/content/zmanimSeoPages.ts) instead of seoPages.ts, keeping hebcal
  //     out of the Vue chunks that import seoPages.
  const { pages: zmanimPages, sitemapEntries: zmanimEntries } = buildZmanimSeoPages();
  for (const page of zmanimPages) {
    writePage(dist, template, page);
    console.log(`[prerender-seo] ${page.path} -> dist/${page.file}`);
  }

  // 2d. Paracha de la semaine (/paracha) : le calendrier daté des parachiot,
  //     bâti du même cycle que les dates posées sur les pages de textes.
  const { pages: parashaPages, sitemapEntries: parashaEntries } = buildParashaSeoPages();
  for (const page of parashaPages) {
    writePage(dist, template, page);
    console.log(`[prerender-seo] ${page.path} -> dist/${page.file}`);
  }

  // 3. Sitemaps, regenerated from the same lists so they can never drift : un
  //    fichier par famille, et l'index à /sitemap.xml (l'adresse déclarée dans
  //    robots.txt et dans les consoles des moteurs, inchangée).
  const horairesEntries = zmanimEntries.filter((e) => isSectionPath(e.path, "horaires"));
  const calendrierEntries = zmanimEntries.filter((e) => !isSectionPath(e.path, "horaires"));
  const pageEntries = sitemapEntriesOfPages().map((e) => ({ ...e, lastmod: contentDate }));
  const sitemaps = [
    ["sitemap-pages.xml", [...pageEntries, ...parashaEntries]],
    ["sitemap-bibliotheque.xml", readingEntries],
    ["sitemap-horaires.xml", horairesEntries],
    ["sitemap-calendrier.xml", calendrierEntries],
  ];
  for (const [file, entries] of sitemaps) {
    writeFileSync(join(dist, file), buildSitemapFile(today, entries), "utf-8");
    console.log(`[prerender-seo] ${file}: ${entries.length} URL(s)`);
  }
  writeFileSync(
    join(dist, "sitemap.xml"),
    buildSitemapIndex(
      today,
      sitemaps.map(([file]) => file),
    ),
    "utf-8",
  );

  // 4. llms-full.txt : le texte des pages principales, en français (les pages
  //    de villes sont exclues : le hub /horaires porte déjà Paris et l'annuaire).
  const isFrench = (p) => (p.locale ?? "fr") === "fr" && p.sitemap !== false;
  const llmsPages = [
    ...allPages.filter(isFrench),
    ...zmanimPages.filter((p) => isFrench(p) && !/^\/horaires\/./.test(p.path)),
    ...parashaPages.filter(isFrench),
  ];
  writeFileSync(join(dist, "llms-full.txt"), buildLlmsFull(llmsPages, today), "utf-8");
  console.log(`[prerender-seo] llms-full.txt: ${llmsPages.length} page(s)`);

  const total = allPages.length + zmanimPages.length + parashaPages.length + readingEntries.length;
  console.log(`[prerender-seo] Generated ${total} page(s) + app.html + sitemap.xml (index).`);
  console.log(`[prerender-seo] Canonical host: ${SITE_URL}`);
}

main();
