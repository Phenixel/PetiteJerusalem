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
- `src/content/zmanimSeoPages.ts`: the **/horaires** (heures de Chabbat) and
  **/calendrier** (dates des fêtes) pages, plus one **/horaires/&lt;ville&gt;**
  page per big francophone community (list in `src/content/zmanimCities.ts`:
  Marseille, Lyon, Strasbourg… + Bruxelles, Genève, Montréal, Tel Aviv…).
  Their crawlable bodies embed real times computed at build time with
  `@hebcal/core` (12 weeks of candle lighting/havdala per city, the festival
  calendar of the current + next Hebrew year, and "Quand tombe Roch
  Hachana/Kippour/Pessah… ?" FAQ answers). This lives in its own module, not
  `seoPages.ts`, so hebcal stays out of the Vue chunks that import `seoPages`
  (ContentPage, TehilimPage); only the prerender step and the tests load it.
  Every row is dated, so the content stays truthful between deploys, but
  **deploy at least every few weeks** to keep the upcoming-times table ahead
  of the calendar. The `/horaires/:ville` route is real app behavior too:
  ZmanimPage resolves the slug against the city catalogue and computes live
  times for it (any catalogue city works, only the listed ones are
  prerendered). Paris has no city page (`/horaires` is the Paris page) and
  Jérusalem is deliberately excluded (local custom is 40 minutes before
  sunset, the app computes 18 everywhere).
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

Prerendered/indexable pages (~1200 in total, all listed in the generated
`sitemap.xml`): the static pages declared in `seoPages.ts`, `/`,
`/share-reading`, `/bibliotheque`, `/chiourim`, the landing/legal pages above,
the Tehilim-by-intention hub + its intention pages, `/horaires` and
`/calendrier` (from `zmanimSeoPages.ts`), plus the Bibliothèque
reading pages generated per corpus/book/chapter by `prerender-seo.mjs`.
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
     `/calendrier`.
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
