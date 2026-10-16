# SEO Petite Jérusalem

How the site is made findable by search engines **and** by AI assistants
(ChatGPT, Claude, Perplexity), and the manual steps that remain to finish
the job.

## Why it was invisible (the diagnosis)

1. **`sitemap.xml` and `robots.txt` pointed to a dead domain.** All URLs
   used `petite-jerusalem.web.app`, which returns **404**. Google was
   receiving a sitemap full of dead links. Fixed: both now use
   `petite-jerusalem.fr`.
2. **The body of the served HTML was empty** (`<div id="app"></div>`).
   Crawlers that do not execute JavaScript (Bing, GPTBot, ClaudeBot,
   PerplexityBot…) saw no content. Fixed: the build now prerenders a real
   `<body>` per page (see below).
3. **Brand name collision.** « Petite Jérusalem » is also a 2005 film with
   its own Wikipedia page: a new site with no authority cannot yet win its
   own name. We keep the name and bet on descriptive, task-oriented copy,
   and on inbound links.
4. **Vocabulary mismatch.** The copy said « centre spirituel numérique »
   ("digital spiritual center"); people search for « finir le Chass »,
   « répartir les Tehilim », « refoua chelema ». Copy and landing pages were
   rewritten around these real terms.

## One URL per language

The site is written in French, English and Hebrew, but for a long time it
had **a single URL per page**, the language being chosen in the browser
(localStorage, then `navigator.language`). Googlebot received the French
version and had no way to discover the other two: no address carried them.
The English and Hebrew translations of the landing pages already existed in
`seoPages.ts` and were served to nobody.

The standard scheme now applies, driven by `src/content/seoLocales.ts`:

- French stays at the root (it is the historical URL set, and the
  `x-default`); English and Hebrew take a prefix, and the segments are
  translated, because an English speaker searches for « shabbat times »,
  not « horaires »:

  | fr                   | en                       | he                        |
  | -------------------- | ------------------------ | ------------------------- |
  | `/horaires/lyon`     | `/en/shabbat-times/lyon` | `/he/zmanei-shabbat/lyon` |
  | `/calendrier/pessah` | `/en/holidays/passover`  | `/he/chagim/pesach`       |
  | `/paracha`           | `/en/parasha`            | `/he/parasha`             |
  | `/finir-le-chass`    | `/en/finish-the-shas`    | `/he/siyum-hashas`        |

  City slugs are **not** translated: they are proper nouns, and one slug
  per city gives a single catalog instead of three that would drift apart.

- The prerender writes `lang` and `dir` on the document (`dir="rtl"` for
  Hebrew), the page's own `og:locale`, and the cross-referencing
  `hreflang` links in the `<head>` and in `sitemap.xml` (`xhtml:link`). A
  page that does not exist in a language is simply not declared there,
  rather than promising a translation that does not exist.
- The router's localized routes are generated from the same table: a
  segment can therefore never diverge between the router and the generated
  files. A prefixed URL imposes its language (`router.beforeEach`, waiting
  for the locale chunk so the title is not French for an instant); URLs
  without a prefix touch nothing, the historical behavior is unchanged.
- The language switcher follows the address: on a translated page it
  navigates to the sibling URL, elsewhere it only changes the text.
- Internal links to translated sections follow **the session's language
  space** (`useLocalePath`): the last prefixed URL opened, or the last
  switcher choice. Going through a single-address page (Library, chiourim,
  profile) does not drop the `/en` from subsequent links, so the URL a
  visitor shares stays in their language. The space applies to the session
  only, never stored: a new launch is decided by the address alone, and a
  session that has never touched `/en` or `/he` is never prefixed.

Translated today: the home page, the landing and legal pages (their
`en`/`he` content already existed), `/horaires` and its 242 city pages,
`/calendrier` and its 15 holiday pages, `/zmanim` and `/paracha`. The
Tehilim-by-intention pages and the ~1200 Library reading pages remain
French-only for now, and declare no `hreflang` rather than a false one.

The generated families keep their sentences in `zmanimSeoStrings.ts`,
`zmanimGuideStrings.ts` and `parashaStrings.ts`, one set written per
language (not a literal transposition: « sof zman shema » is what people
search for in English). City and country names live in `zmanimCities.ts`,
holiday names and slugs in `zmanimFestivals.ts`.

**Page titles and the vertical bar.** Runtime titles go through `t()`, and
vue-i18n reads `|` as a plural separator: each `seo.*Title` was truncated
at the first bar, « Petite Jerusalem | Partager… » came out as « Petite
Jerusalem ». The messages in the `seo` block therefore escape it
(`{'|'}`), and `src/__tests__/seoTitles.test.ts` holds the line.

## How prerendering works

The app is a Vue SPA on Firebase Hosting. We do **not** do runtime SSR (the
app touches `localStorage` and Firebase on import, which breaks under
Node). Instead:

- `src/content/seoPages.ts`: the **single source of truth** for the title,
  description, crawlable `bodyHtml` and JSON-LD of each indexable page.
  Imported by both the Vue app and the build step, so the markup never
  drifts.
- `scripts/prerender-seo.mjs` (run after `vite build`, loads the TS module
  through `jiti`) writes one static HTML file per route into `dist/`, with
  a route-specific `<head>`, the JSON-LD and a real `<body>`. With
  `cleanUrls: true`, `/share-reading` is served directly from
  `dist/share-reading.html`.
  - It also writes **`dist/app.html`**: an empty shell, target of the
    catch-all rewrite, so that the app's deep routes (`/profile`, …) never
    flash the home page content (`firebase.json`: `"**"` to `/app.html`).
    Its canonical and `og:url` tags are **removed** (`buildAppShell` in
    `seoPages.ts`): the shell serves every non-prerendered route, and
    keeping the home page's canonical made each of them look like a
    duplicate of `/` (Search Console: « Page en double, Google a choisi une
    URL canonique différente », "Duplicate, Google chose different canonical
    than user"). The Vue views set the right canonical on mount
    (`seoService`).
  - It also regenerates the sitemaps from the same page lists:
    **`dist/sitemap.xml`** is a sitemap _index_ pointing to one file per
    page family (`sitemap-pages.xml`, `sitemap-bibliotheque.xml`,
    `sitemap-horaires.xml`, `sitemap-calendrier.xml`), so that Search
    Console reports indexing family by family. Each URL carries a **real
    `lastmod`**: the date of the last commit that touched the file the page
    is made from (the text file for a reading page, `seoPages.ts` for a
    content page), read in a single `git log` by
    `scripts/lib/lastmod.mjs`. Computed pages (times, calendar, paracha,
    dated parachiot) carry the build date, because they really change with
    each build. Without git history (shallow clone), everything falls back
    to the build date; the deployment workflows therefore check out with
    `fetch-depth: 0`.
- `src/content/zmanimSeoPages.ts`: everything that needs computed dates or
  times, prerendered from `@hebcal/core` at build time:
  - **`/horaires`** (Paris): twelve weeks of candle lighting and havdala,
    the full table of the day's zmanim (alot, michéyakir, netz, sof zman
    Chema and Tefila according to both opinions, 'hatsot, min'ha guedola
    and ketana, plag, chkia, tseit, 'hatsot halayla), the paracha of each
    upcoming Chabbat linked to its Library page, and the directory of all
    city pages grouped by country.
  - **`/horaires/<ville>`**, one per city in `src/datas/cities.json` (242,
    all but Paris, whose page _is_ `/horaires`): the same twelve weeks and
    the same zmanim table computed at the city's coordinates, plus its six
    nearest cities with their distances. Jerusalem is among them: candle
    lighting there is 40 minutes before sunset, and
    `candleLightingMinutes` in `zmanimService` carries this local custom
    (18 minutes everywhere else). The list of featured communities lives in
    `src/content/zmanimCities.ts` (`FEATURED_CITY_NAMES`), with the slugs
    shared with the router.
  - **`/calendrier`**: the holidays of the current Hebrew year and the next
    one with start and end times, plus a « grandes fêtes sur sept années
    hébraïques » ("major holidays over seven Hebrew years") table.
  - **`/calendrier/<fete>`**, one per holiday in
    `src/content/zmanimFestivals.ts` (15: roch-hachana, yom-kippour,
    souccot, simhat-torah, hanouka, tou-bichvat, jeune-esther, pourim,
    pessah, lag-baomer, chavouot, and the fasts): its dates over six
    upcoming years, in civil and Hebrew dates, start and end times when it
    is a Yom Tov, and a « Quand tombe X <année> ? » ("When is X <year>?")
    FAQ per year. The `/calendrier/:fete` route is also a real app
    behavior: CalendarPage resolves the slug, opens the year that holds the
    next occurrence and highlights it. All of this lives in its own module,
    not in `seoPages.ts`, so that hebcal stays out of the Vue chunks that
    import `seoPages` (ContentPage, TehilimPage); only the prerender,
    `indexnow.mjs` and the tests load it. Each row is dated, so the content
    stays true between two deployments, but you must **deploy at least
    every few weeks** so the upcoming times tables stay ahead of the
    calendar. `/horaires/:ville` is also a real app behavior: ZmanimPage
    resolves the slug against the city catalog and computes the times live.
- `src/content/parashaSeoPages.ts`: the **`/paracha`** hub (the week's
  paracha, then the dated calendar of the whole cycle, each paracha linked
  to its text in the Library) and the dated sentence injected into each of
  the 54 paracha reading pages (« Cette paracha se lit le Chabbat 31
  octobre 2026, puis le Chabbat 20 novembre 2027 »), which makes « quand
  lit-on Ki Tétsé » ("when is Ki Tetze read") land on a page that already
  existed. Vezot Haberakha is never read on an ordinary Chabbat, so it is
  dated from Sim'hat Torah. The calendar itself lives in
  `src/content/parashaCalendar.ts` (dailyCycles only, no `seoPages`),
  shared with `src/views/Library/ParashaPage.vue`, which recomputes it live
  for visitors. This is the page most sensitive to site deployment: its
  lead and its FAQ name the Chabbat they were built for, so they never
  become false, but they age. A weekly deployment makes « this week »
  really mean this week.
- `guidePages` in `src/content/seoPages.ts` holds the timeless guides that
  need no computation, currently **`/zmanim`** (what each zman marks, the
  two opinions, how it is computed), rendered for humans by
  `src/views/SeoGuidePage.vue` from the same `bodyHtml`.
- **None of this ships in the native app.** All prerendered SEO content is
  web-only: `scripts/prune-native-bundle.mjs` (run by `npm run app:build`,
  between `vite build` and `cap sync`) removes from the Capacitor bundle
  every prerendered `.html` page, `sitemap.xml` and its four child sitemaps
  (`sitemap-pages.xml`, `sitemap-bibliotheque.xml`, `sitemap-horaires.xml`,
  `sitemap-calendrier.xml`), `robots.txt`, `llms.txt`, `llms-full.txt`,
  `og-image.jpg`, the IndexNow key (`7928be0e14242cf92e167550affa3215.txt`),
  `texts/manifest.json`, `app-version.json` and the `.well-known/` folder,
  and replaces its `index.html` entry with the bare shell (`app.html`), so
  the app never flashes SEO text on launch. Navigation in the app is fully
  client-side and never loads these files anyway; removing them also saves
  ~79 MB of HTML in the APK and the IPA. A test locks this behavior in
  (`src/__tests__/pruneNativeBundle.test.ts`).
- **`/bibliotheque/<corpus>`** (`tehilim`, `michna`, `talmud`, `tanakh`):
  one static page per corpus that lists every book as a link, grouped by
  seder, sefer or book (`buildCorpusBody` in `src/content/etudeTexts.ts`),
  with an `ItemList` in JSON-LD. Before, the list of books only existed in
  the Vue view, so a crawler had no path from the library to the ~1200
  reading pages (the brahot and sidour pages had no inbound link).
  `StudyPage.vue` sets the same French title and description at runtime,
  so that the page rendered by Googlebot matches the served HTML.
- **`/sidour`**: all the liturgy texts (tefilot, brahot, holiday texts) on
  one page, arranged by use as in the app (`src/content/sidourSeo.ts`,
  groups from `sidourGroups.ts`), with an `ItemList` in JSON-LD. It
  replaces the `/bibliotheque/sidour`, `/moadim` and `/brahot` lists, which
  301-redirect to it (`firebase.json`); the text pages keep their address
  under `/bibliotheque` and link back up to `/sidour`. `SidourPage.vue`
  sets the same title and description.
- `src/views/ContentPage.vue` renders the long landing and legal pages
  (`landingPages` in `seoPages.ts`: `/finir-le-chass`, `/partage-tehilim`,
  `/confidentialite`, `/a-propos`, `/mentions-legales`) from the same
  `bodyHtml`: a human and a crawler receive identical content.
- `functions/src/index.ts` (`socialPreview`) injects a per-page `<head>`
  and a small `<body>` for the **dynamic** routes (individual sessions,
  chiourim, authors) that cannot be known at build time.

Prerendered and indexable pages (~2025 in total, all listed in the
generated sitemaps): the static pages declared in `seoPages.ts`, `/`,
`/share-reading`, `/bibliotheque`, `/chiourim`, the landing and legal pages
above, `/zmanim`, `/paracha`, the Tehilim-by-intention hub and its
intention pages, `/horaires` and its 242 city pages, `/calendrier` and its
15 holiday pages (from `zmanimSeoPages.ts`, each in three languages), plus
the four corpus pages, `/sidour` and the Library reading pages generated
per corpus, book and chapter by `prerender-seo.mjs`. (`/login` is
`noindex`; the old `/etude` URLs 301-redirect to `/bibliotheque` in
`firebase.json`.)

Structured data emitted: `WebSite`, `Organization`, `WebApplication`,
`HowTo`, `Article`, `FAQPage`, `BreadcrumbList`, `ItemList`.

`public/llms.txt` describes the site for AI agents, and the build writes
**`dist/llms-full.txt`** next to it (`buildLlmsFull` in
`prerender-seo.mjs`): the text of the ~37 main French pages (home, landing
pages, guides, Tehilim by intention, `/horaires`, `/calendrier` and the
holidays, `/paracha`), each under its URL, for an assistant that reads a
single file. Reading pages are excluded (tens of megabytes). `robots.txt`
explicitly names each AI crawler (search-time fetchers such as
`OAI-SearchBot`, `Claude-User`, `Perplexity-User`, `MistralAI-User`, and
training crawlers such as `GPTBot`, `ClaudeBot`, `Google-Extended`,
`CCBot`); which index each assistant actually queries, and how to check
that the site appears there, is in `docs/audit-seo-2026-09.md`, section 5.

The dynamic pages served by `socialPreview` also carry JSON-LD: a chiour
is an `AudioObject` (author, ISO 8601 duration, `contentUrl`, free),
sessions and chiourim have a `BreadcrumbList`.

`index.html` also redirects the technical Firebase hosts
(`petite-jerusalem-dev.web.app`, `.firebaseapp.com`) to the canonical
domain with a tiny inline script: the same site responds there (it is what
`deploy.yml` queries to verify a release) and would otherwise be a
duplicate. Preview channels (`petite-jerusalem-dev--pr123-xxx.web.app`) and
the native app (`localhost` origin) are not affected.

## Keeping dated pages fresh (weekly refresh)

`/paracha` names « this week », the city pages cover twelve weeks from the
build, the holiday FAQs are dated. They are true at build time and only
stay true as long as the build is recent. Releases alone (`deploy.yml`, on
a tag) did not guarantee this, so **`.github/workflows/refresh-seo.yml`**
runs on Sunday and Wednesday at 03:00 UTC (and on demand): it rebuilds the
**latest deployed tag** (not `main`: the site stays at the published
version, only the dates move), deploys hosting alone, checks that the
served `sitemap.xml` carries today's date, and notifies IndexNow. A
`concurrency` group prevents it from interleaving with a release. If the
workflow is red two weeks in a row, the « this week » text goes stale:
check Actions after a Sunday.

## Deployment and post-deployment checklist (manual, owner only)

After `npm run build` and `firebase deploy`:

1. **Test the rewrites** (already verified locally through the hosting
   emulator):
   ```bash
   curl -s https://petite-jerusalem.fr/finir-le-chass | grep -o '<title>[^<]*</title>'
   curl -s https://petite-jerusalem.fr/sitemap.xml | head
   curl -s -o /dev/null -w "%{http_code}\n" https://petite-jerusalem.fr/profile   # 200 (app.html)
   ```
2. **Google Search Console** (https://search.google.com/search-console):
   - Add the `petite-jerusalem.fr` property (domain property, verified
     through a DNS TXT record).
   - Submit `https://petite-jerusalem.fr/sitemap.xml` (a sitemap index:
     the four child sitemaps appear below it, each with its own coverage).
   - Use **URL Inspection, then Request indexing** for `/`,
     `/share-reading`, `/finir-le-chass`, `/partage-tehilim`,
     `/bibliotheque`, `/bibliotheque/talmud`, `/bibliotheque/tehilim`,
     `/horaires`, `/calendrier`, `/zmanim`, `/en`, `/he`.
3. **Bing Webmaster Tools** (https://www.bing.com/webmasters): add the
   site, submit the sitemap. (Bing also powers ChatGPT search.)
4. Check that the old `petite-jerusalem.web.app` redirects to `.fr` or
   stays a 404 (it must not serve a duplicate of the site).

## Being found by AI assistants

LLMs recommend a site when it is (a) crawlable as text (which is now the
case) and (b) present in their training or retrieval corpus, which mostly
requires **being indexed and linked from elsewhere**. In practice:

- Get inbound links from Jewish community sites, synagogue and kehilot
  newsletters, Torah study directories and association pages. A handful of
  real links is the strongest lever for a new domain.
- Name the exact use cases in those links (« un site pour finir le Chass à
  plusieurs », « répartir les Tehilim pour une refoua chelema »): this
  anchor text is what both Google and LLMs associate with the site.
- Keep `llms.txt` and the FAQ answers up to date; that is the text an
  assistant is most likely to quote.

## IndexNow (Bing, Yandex, ChatGPT search)

The site is set up for **IndexNow**, which instantly notifies Bing and
Yandex of new or changed URLs (Bing also powers ChatGPT's web search).
Google does not use it.

- The ownership key is hosted in `public/<clé>.txt` (served at the domain
  root).
- Submit the indexable URLs after a deployment with **`npm run
  indexnow`** (`scripts/indexnow.mjs`, URL list read from the sitemaps the
  build wrote into `dist/`, reading pages included). `deploy.yml` and
  `refresh-seo.yml` run it after each hosting go-live.

## Audit

`docs/audit-seo-2026-09.md` holds the September 2026 audit: what was found
on the built pages, what the accompanying PR fixed, what remains to be done
in the code, and the manual actions (Search Console, Bing, inbound links)
with a ready-to-paste prompt for Claude Cowork.

## Adding an SEO page

Add an entry to `appPages` (existing Vue view) or to `landingPages` (new
ContentPage route, plus a route in `src/router/routes.ts`) in
`src/content/seoPages.ts`. The sitemap, the static file and the Vue
rendering follow automatically. Run `npm run build` and check
`dist/<fichier>.html`.
