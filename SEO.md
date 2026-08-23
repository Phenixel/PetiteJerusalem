# SEO Petite Jérusalem

How the site is made findable by search engines **and** AI assistants
(ChatGPT, Claude, Perplexity), and the manual steps to finish the job.

## Why it was invisible (the diagnosis)

1. **`sitemap.xml` + `robots.txt` pointed at a dead domain.** Every URL used
   `petite-jerusalem.web.app`, which returns **404**. Google was handed a
   sitemap full of dead links. → Fixed: both now use `petite-jerusalem.fr`.
2. **The served HTML body was empty** (`<div id="app"></div>`). Bots that don't
   run JS (Bing, GPTBot, ClaudeBot, PerplexityBot…) saw no content. → Fixed: the
   build now prerenders real `<body>` content per page (see below).
3. **Brand-name collision.** "Petite Jérusalem" is also a 2005 film with a
   Wikipedia page, so a zero-authority new site can't win its own name yet. → We
   keep the name and lean on descriptive, task-oriented copy + inbound links.
4. **Vocabulary mismatch.** The copy said "centre spirituel numérique"; users
   search "finir le Chass", "répartir les Tehilim", "refoua chelema". → Copy and
   landing pages rewritten around those real terms.

## How prerendering works

The app is a Vue SPA on Firebase Hosting. We do **not** run runtime SSR (the app
touches `localStorage`/Firebase at import time, which breaks in Node). Instead:

- `src/content/seoPages.ts`: the **single source of truth** for title,
  description, crawlable `bodyHtml` and JSON-LD for every indexable page.
  Imported by both
  the Vue app and the build step, so the markup never drifts.
- `scripts/prerender-seo.mjs` (runs after `vite build`, loads the TS module via
  `jiti`) writes one static HTML file per route into `dist/` with route-specific
  `<head>` + JSON-LD + real `<body>`. With `cleanUrls: true`, `/share-reading`
  is served straight from `dist/share-reading.html`.
  - Also writes **`dist/app.html`**: a bare empty shell used as the catch-all
    rewrite target, so deep app routes (`/profile`, …) never flash homepage
    content. (`firebase.json`: `"**" → "/app.html"`.) Its canonical + `og:url`
    tags are **stripped** (`buildAppShell` in `seoPages.ts`): the shell serves
    every non-prerendered route, and keeping the homepage canonical there made
    each of them claim to be a duplicate of `/` (Search Console "Duplicate
    page, Google chose a different canonical"). The Vue views set the right
    canonical on mount (`seoService`).
  - Also regenerates **`dist/sitemap.xml`** from the same page list.
- `src/content/zmanimSeoPages.ts`: everything that needs computed dates or
  times, prerendered from `@hebcal/core` at build time:
  - **`/horaires`** (Paris): twelve weeks of candle lighting/havdala, the
    day's full zmanim table (alot, misheyakir, netz, sof zman Shema/Tefilla in
    both opinions, chatzot, mincha gedola/ketana, plag, shkia, tzeit, chatzot
    halayla), the parasha of each upcoming Shabbat linked to its Bibliothèque
    page, and the directory of every city page grouped by country.
  - **`/horaires/<ville>`**, one per city in `src/datas/cities.json` (242,
    every city except Paris, whose page _is_ `/horaires`): the same twelve
    weeks and the same zmanim table computed at that city's coordinates, plus
    its six nearest cities with distances. Jerusalem is included: candle
    lighting there is 40 minutes before sunset, and `candleLightingMinutes`
    in `zmanimService` carries that local usage (18 minutes everywhere else).
    The list of highlighted communities lives in `src/content/zmanimCities.ts`
    (`FEATURED_CITY_NAMES`), along with the slugs shared with the router.
  - **`/calendrier`**: the festivals of the current + next Hebrew year with
    entry/exit times, plus a "big festivals over seven Hebrew years" table.
  - **`/calendrier/<fete>`**, one per festival in
    `src/content/zmanimFestivals.ts` (15: roch-hachana, yom-kippour, souccot,
    simhat-torah, hanouka, tou-bichvat, jeune-esther, pourim, pessah,
    lag-baomer, chavouot, and the fasts): its dates over six upcoming years in
    civil + Hebrew dates, entry/exit times when it is a Yom Tov, and a "Quand
    tombe X <année> ?" FAQ per year. The route `/calendrier/:fete` is real app
    behavior too: CalendarPage resolves the slug, opens the year that carries
    the next occurrence and highlights it.
    This lives in its own module, not `seoPages.ts`, so hebcal stays out of the
    Vue chunks that import `seoPages` (ContentPage, TehilimPage); only the
    prerender step, `indexnow.mjs` and the tests load it. Every row is dated, so
    the content stays truthful between deploys, but **deploy at least every few
    weeks** to keep the upcoming-times tables ahead of the calendar.
    `/horaires/:ville` is real app behavior as well: ZmanimPage resolves the
    slug against the city catalogue and computes live times for it.
- `src/content/parashaSeoPages.ts`: the **`/paracha`** hub (this week's
  parasha, then the dated calendar of the whole cycle, each parasha linked to
  its Bibliothèque text) and the dated sentence injected into each of the 54
  parasha reading pages ("Cette paracha se lit le Chabbat 31 octobre 2026,
  puis le Chabbat 20 novembre 2027"), which is what makes "quand lit-on Ki
  Tétsé" resolve to a page that already existed. Vezot Haberakha is never read
  on an ordinary Shabbat, so it is dated from Simhat Torah instead. The
  calendar itself lives in `src/content/parashaCalendar.ts` (dailyCycles only,
  no `seoPages`), shared with `src/views/Library/ParashaPage.vue`, which
  recomputes it live for visitors.
- `guidePages` in `src/content/seoPages.ts` holds the evergreen explainers
  that need no computation, today **`/zmanim`** (what each zman marks, the two
  opinions, how it is computed), rendered for humans by
  `src/views/SeoGuidePage.vue` from the very same `bodyHtml`.
- **None of this ships in the native app.** All the prerendered SEO content is
  web-only: `scripts/prune-native-bundle.mjs` (run by `npm run app:build`,
  between `vite build` and `cap sync`) strips every prerendered `.html` page,
  `sitemap.xml`, `robots.txt` and `llms.txt` from the Capacitor bundle, and
  replaces its `index.html` entry with the bare shell (`app.html`), so the app
  never flashes SEO text at launch. In-app navigation is fully client-side and
  never loads those files anyway; removing them also saves ~79 MB of HTML in
  the APK/IPA. A test locks this behavior
  (`src/__tests__/pruneNativeBundle.test.ts`).
- `src/views/ContentPage.vue` renders the long-form landing and legal pages
  (`landingPages` in `seoPages.ts`: `/finir-le-chass`, `/partage-tehilim`,
  `/confidentialite`, `/a-propos`, `/mentions-legales`) from the same
  `bodyHtml`, so a human and a crawler get identical content.
- `functions/src/index.ts` (`socialPreview`) injects per-page `<head>` + a small
  `<body>` for **dynamic** routes (individual sessions, chiourim, authors) that
  can't be known at build time.

Prerendered/indexable pages (~1465 in total, all listed in the generated
`sitemap.xml`): the static pages declared in `seoPages.ts`, `/`,
`/share-reading`, `/bibliotheque`, `/chiourim`, the landing/legal pages above,
`/zmanim`, `/paracha`, the Tehilim-by-intention hub + its intention pages, `/horaires` +
its 242 city pages and `/calendrier` + its 15 festival pages (from
`zmanimSeoPages.ts`), plus the Bibliothèque reading pages generated per
corpus/book/chapter by `prerender-seo.mjs`.
(`/login` is `noindex`; the old `/etude` URLs 301-redirect to
`/bibliotheque` in `firebase.json`.)

Structured data emitted: `WebSite`, `Organization`, `WebApplication`, `HowTo`,
`Article`, `FAQPage`, `BreadcrumbList`, `ItemList`.

`public/llms.txt` describes the site for AI agents.

## Deploy + post-deploy checklist (manual, only the owner can do these)

After `npm run build` and `firebase deploy`:

1. **Smoke-test the rewrites** (already verified locally via the hosting
   emulator):
   ```bash
   curl -s https://petite-jerusalem.fr/finir-le-chass | grep -o '<title>[^<]*</title>'
   curl -s https://petite-jerusalem.fr/sitemap.xml | head
   curl -s -o /dev/null -w "%{http_code}\n" https://petite-jerusalem.fr/profile   # 200 (app.html)
   ```
2. **Google Search Console** (https://search.google.com/search-console):
   - Add the property `petite-jerusalem.fr` (Domain property → DNS TXT verify).
   - Submit `https://petite-jerusalem.fr/sitemap.xml`.
   - Use **URL Inspection → Request indexing** for `/`, `/share-reading`,
     `/finir-le-chass`, `/partage-tehilim`, `/bibliotheque`, `/horaires`,
     `/calendrier`, `/zmanim`.
3. **Bing Webmaster Tools** (https://www.bing.com/webmasters): add the site,
   submit the sitemap. (Bing also feeds ChatGPT search.)
4. Confirm the old `petite-jerusalem.web.app` either redirects to `.fr` or stays
   404 (it must not serve a duplicate of the site).

## Getting found by AI assistants

LLMs recommend a site when it is (a) crawlable as text (now true) and (b)
present in their training/retrieval corpus, which mostly requires **being
indexed and linked from elsewhere**. Concretely:

- Get inbound links from Jewish community sites, shul/kehila
  newsletters, Torah-study directories, and association pages. A handful of real
  links is the single biggest lever for a new domain.
- Mention the exact use-cases in those links ("un site pour finir le Chass à
  plusieurs", "répartir les Tehilim pour une refoua chelema"), and that anchor text
  is what both Google and LLMs associate with the site.
- Keep `llms.txt` and the FAQ answers up to date; they are the text an assistant
  is most likely to quote.

## IndexNow (Bing / Yandex / ChatGPT search)

The site is set up for **IndexNow**, which instantly notifies Bing and Yandex of
new/updated URLs (Bing also feeds ChatGPT's web search). Google does not use it.

- Ownership key is hosted at `public/<key>.txt` (served from the domain root).
- Submit the indexable URLs after a deploy with **`npm run indexnow`**
  (`scripts/indexnow.mjs`, URL list derived from the same page list as the
  sitemap). Re-run it whenever content changes meaningfully.

## Adding a new SEO page

Add an entry to `appPages` (existing Vue view) or `landingPages` (new
ContentPage route + a route in `src/router/routes.ts`) in
`src/content/seoPages.ts`. The sitemap, the static file and the Vue render all
follow automatically. Run `npm run build` and check `dist/<file>.html`.
