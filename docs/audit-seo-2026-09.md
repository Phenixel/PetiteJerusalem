# SEO audit (September 2026)

A complete pass over what makes the site findable: the HTML served to robots
(local build of the 2,020 prerendered pages, checked by script: titles,
descriptions, h1, canonicals, hreflang, internal links, JSON-LD), the files
for robots (`robots.txt`, `sitemap.xml`, `llms.txt`), the functions that
serve dynamic pages, the deployment pipeline, and what cannot be seen in the
code (domain authority, search engine consoles).

The production site was not reachable from the audit environment: the online
checks (headers, `www` redirects, Search Console status) are in section 4, to
be done by hand.

Complements `SEO.md` (how search visibility is built) and the "real
`lastmod` in the sitemap" item in `audit-review-2026-09.md`.

## 1. What is already good

- **Everything is prerendered.** 2,020 complete HTML pages, one per indexable
  URL, all with a title, description, canonical, `lang`/`dir`, valid JSON-LD
  and a single h1. No broken internal links, no non-reciprocal hreflang.
- **One URL per language** (`/`, `/en`, `/he`, translated segments), hreflang
  cross-references in the `<head>` and in the sitemap, `x-default` on French.
- **High-demand computed pages**: 243 cities × 3 languages of Chabbat times
  with a dated FAQ, 16 holidays × 3 languages, the weekly paracha, Tehilim by
  intention, zmanim explained.
- **Structured data** wherever it makes sense: `BreadcrumbList` (2,015
  pages), `FAQPage` (796), `CreativeWork` (1,100), `Article`, `HowTo`,
  `WebApplication`, `WebSite`, `Organization`.
- **Social previews for dynamic pages** (sessions, chiourim, series, authors)
  through the `socialPreview` function, an Open Graph card per session.
- `robots.txt` open to AI crawlers, `llms.txt`, IndexNow after each release,
  `noindex` on pages of no interest (`/login`, 404, `/lire`).

## 2. What was missing, and what the PR fixes

### Internal linking: 1,200 pages with no path from the library

The list of books in a corpus (`/bibliotheque/talmud`, `/bibliotheque/michna`…)
only existed in the Vue view: a robot without JavaScript received the empty
shell (`app.html`), with no canonical. The ~1,200 reading pages were only
linked to each other through the sitemap and their neighbors (next chapter),
and 31 pages had **no** incoming link at all: the 14 brahot, the 6 sidour
pages, the Sli'hot, the legal pages and « À propos » ("About") in all three
languages. A search engine found them through the sitemap, with nothing to
rank them.

Fixed:

- **One static page per corpus** (`/bibliotheque/tehilim`, `/michna`,
  `/talmud`, `/tanakh`, `/sidour`, `/brahot`), with each book linked, grouped
  by seder, sefer or book, its own title and description, a breadcrumb and
  an `ItemList` in JSON-LD (`buildCorpusBody` in
  `src/content/etudeTexts.ts`). The path home → library → corpus → book →
  chapter now exists in HTML.
- `/bibliotheque` links the six corpora (and the Sli'hot directly, since the
  `/bibliotheque/slihot` redirect only exists client-side); each reading page
  links back to its corpus list.
- The static footer links the legal pages in each language.
- `StudyPage.vue` sets, in French, the same title and description as the
  prerendered page: Googlebot renders JavaScript, and two different titles
  left it to choose.

Result: no orphan pages left (audit rerun on the build).

### Sitemap: misleading `lastmod` and a single file

Every URL carried the build date: 2,000 pages "modified" on every
deployment, including 1,200 reading pages whose text never changes. Google
says it only uses `lastmod` if it is consistently accurate; lying about it
everywhere amounted to saying nothing, and a weekly deployment would have
made it worse.

Fixed:

- **Real `lastmod`**: the date of the last commit of the file the page is
  made from (the text file for a reading page, `seoPages.ts` for a content
  page), read in a single `git log` (`scripts/lib/lastmod.mjs`). Computed
  pages (prayer times, calendar, paracha, dated parachiot) keep the build
  date: they really do change. Without git history (shallow clone), it falls
  back to the build date, as before. `deploy.yml` therefore checks out the
  full history.
- **A sitemap index** at `/sitemap.xml` (same address) pointing to one file
  per family: `sitemap-pages.xml`, `sitemap-bibliotheque.xml`,
  `sitemap-horaires.xml`, `sitemap-calendrier.xml`. Search Console reports
  indexing sitemap by sitemap: we will see which family drops off.
- **IndexNow reads the sitemaps** instead of the list of declared pages: the
  1,200 reading pages, never submitted to Bing until now, now are.

### Freshness: dated pages without regular deployment

Deployment only ran from a tag. Yet `/paracha` names "this week", the prayer
times pages cover twelve weeks from the build, and the holiday FAQ is dated:
without a release for a month, all of that falls a month behind. `SEO.md`
called for a weekly deployment; nothing guaranteed it.

Fixed: **`refresh-seo.yml`**, on Sundays and Wednesdays at 03:00 UTC (and on
demand), rebuilds the **last deployed tag** (not `main`: the site stays at
the published version, only the dates change), deploys hosting only, checks
that the served sitemap carries today's date, and notifies IndexNow. A
concurrency group prevents it from overlapping with a release.

### Duplicate hosts

The site also answers on `petite-jerusalem-dev.web.app` and
`.firebaseapp.com` (that is what `deploy.yml` queries to check the release
went live). Canonicals point to `.fr`, but the shell for deep routes has
none. Fixed: `index.html` sends these two hosts to the canonical domain (PR
preview channels and the native app are not affected). Firebase Hosting
cannot do a host-based 301 redirect; failing that, this is what robots that
execute JavaScript see, Googlebot included.

### `robots.txt`

`/admin` and `/studio/` were only protected by a `noindex` set in
JavaScript; `/app` (the shell) was crawlable with the home page title. All
three are now `Disallow`. Added `Claude-SearchBot`, `Applebot` (Siri,
Spotlight) and `DuckAssistBot`.

### Structured data for dynamic pages

A chiour emitted no JSON-LD: it is now an `AudioObject` (author, ISO 8601
duration, file URL, free), with its breadcrumb; sessions have theirs.

### Twitter card

`seoService` set `twitter:card: summary` when the view specified nothing,
whereas the served HTML says `summary_large_image`: the rendered page
contradicted the served page. Aligned on the large card.

### Identity

`Organization` declares its `sameAs` (App Store, Play Store, GitHub, X):
that is what links the site to its store listings in the knowledge graph.
`llms.txt` describes the corpus pages, the reading URL pattern, the Tehilim
intentions, the sitemap and the apps.

## 3. What remains to be done in the code (by order of value)

1. **Titles too long.** 1,588 titles exceed 65 characters, mostly reading
   pages (« Michna Arakhin Chapitre 1 (א) en hébreu et phonétique | Petite
   Jérusalem », 72). Google cuts around 60. The keywords come first, it is
   the brand that gets dropped; acceptable, but « Michna Arakhin 1 : hébreu
   et phonétique » would save ten characters. File: `sectionTitle` in
   `src/content/etudeTexts.ts`. Likewise, 816 descriptions exceed 165
   characters (Talmud), cut off in results.
2. **Tanakh books on a single page.** `/bibliotheque/tanakh/tehillim` weighs
   749 KB (all 150 psalms in one document, a duplicate of the 150
   `/bibliotheque/tehilim/N` pages), Yirmiyahu 577 KB. Paginating the books
   of Neviim and Ketouvim by chapter (like the Michna) would give indexable
   pages and URLs like « Yechayahou chapitre 53 »; for Tehillim, a canonical
   pointing to `/bibliotheque/tehilim` or removing the duplicate.
3. **One Open Graph image per page.** All pages share `og-image.jpg`. A card
   per city (« Horaires de Chabbat à Lyon ») and per holiday would raise the
   click-through rate on WhatsApp, the community's main sharing channel. The
   mechanism already exists (`functions/src/ogCard.ts`, resvg): a
   `/og/horaires/<ville>.png` route modeled on `/og/session/`.
4. **Podcast RSS feed for the chiourim.** A `/chiourim/feed.xml` feed
   (existing `AudioObject`s, `mediaUrl`, duration) would allow submitting the
   chiourim to Apple Podcasts, Spotify and YouTube Music: an entire discovery
   channel, outside Google. To be generated by the function (the chiourim
   live in Firestore), or by an export at each deployment.
5. **`/chiourim` without a list for robots.** The static page only has three
   paragraphs; the list of chiourim only arrives through JavaScript. Having
   `socialPreview` serve `/chiourim` with the list (already cached in the
   function) would give search engines a path to each chiour.
6. **Render-blocking Google Fonts** (`index.html`): two families loaded from
   `fonts.googleapis.com` before first render, which Lighthouse counts in the
   LCP. Already on the list in `audit-review-2026-09.md` for the app;
   bundling them as subsetted woff2 also applies to the site.
7. **Soft 404.** An unknown city (`/horaires/nulle-part`) and an unknown
   holiday redirect client-side to the hub; an unknown URL renders the 404 as
   `noindex` but with a 200 status (Firebase catch-all rewrite). No
   consequence as long as Google renders JavaScript; nothing simple to do on
   the hosting side.
8. **Content pages in English and Hebrew**: Tehilim by intention and the
   library remain French-only. The intentions ("tehillim for healing") are a
   real opportunity in English.

## 4. Manual actions (outside the repository)

None of the above replaces this; for a young domain, it is even the most
important part.

1. **Google Search Console**: check that the `petite-jerusalem.fr` property
   (domain property, DNS TXT) exists; **resubmit
   `https://petite-jerusalem.fr/sitemap.xml`** (it is now an index; the four
   child sitemaps appear under it); read the Pages report (« Explorée,
   actuellement non indexée » ("Crawled, currently not indexed"),
   « Détectée » ("Discovered"), « Page en double » ("Duplicate page")) family
   by family; request indexing of the corpus pages (`/bibliotheque/talmud`,
   `/bibliotheque/tehilim`…) and of the home page.
2. **Bing Webmaster Tools**: site added, sitemap submitted, IndexNow key
   recognized (IndexNow report). Bing feeds ChatGPT search and DuckDuckGo.
3. **Check online** (the audit sandbox could not):
   `https://www.petite-jerusalem.fr` must 301 redirect to the apex;
   `petite-jerusalem.web.app` must remain a 404;
   `petite-jerusalem-dev.web.app` must send to `.fr` (script from this PR);
   `curl -s https://petite-jerusalem.fr/sitemap.xml | head` must show the
   index; `/bibliotheque/talmud` must serve the list of tractates without
   JavaScript; `/robots.txt` must carry the new `Disallow` lines.
4. **Run `Refresh SEO pages` by hand once** (Actions → workflow → Run
   workflow) to check that it passes, then check the following Sunday that
   the sitemap carries the current date.
5. **Google Business / Knowledge Graph**: nothing to do, this is not a local
   business.
6. **Inbound links**, the only real lever for a domain with no authority
   facing a film of the same name: directories and community sites
   (Consistoire, community sites, Torah-Box, Chiourim.com, Hamodia, Actualité
   Juive, rabbis' blogs), synagogue newsletters, community WhatsApp and
   Facebook groups, store listings (already linked through `sameAs`). Anchor
   links on the use case (« finir le Chass à plusieurs », « horaires de
   Chabbat à Lyon »), not on the name.
7. **Wikipedia / Wikidata**: a Wikidata entry for the site (instance of
   "website", languages, official URL, store identifiers) helps assistants
   tell the site apart from the 2005 film.
8. **Monitor Core Web Vitals** in Search Console (Experience report) and
   PageSpeed Insights on `/`, `/horaires/paris`, `/bibliotheque/tehilim/23`.

## 5. Visibility in AI assistants (ChatGPT, Claude, Gemini, Perplexity)

An assistant does not "know" a site: it finds it in a search index at query
time, then goes and reads the page. Three conditions, and the site's status
for each.

**1. Be in the index the assistant queries.** Each has its own:

| Assistant | Index queried | What feeds it |
| --- | --- | --- |
| ChatGPT (search), Copilot | Bing | Bing Webmaster Tools, IndexNow, `OAI-SearchBot` |
| Gemini, AI Overviews | Google | Search Console, `Googlebot` (`Google-Extended` for training) |
| Claude | Brave Search | no console: Brave crawl from inbound links |
| Perplexity | its own + Bing | `PerplexityBot`, `Perplexity-User` |
| Mistral (Le Chat) | Brave | `MistralAI-User` |
| Open models (Llama, Mistral, DeepSeek…) | training corpus | `CCBot` (Common Crawl) |

Test run during the audit with a search tool backed by a third-party index
(Brave): on `site:petite-jerusalem.fr`, **only one URL from the site comes
up, `/lire/158`**, an old address (now `noindex`, canonical pointing to
`/bibliotheque`). Neither the home page, nor `/horaires`, nor
`/finir-le-chass`. On "petite-jerusalem.fr" in quotes, only the 2005 film.
On the other hand, on « finir le Chass à plusieurs partage talmud », that
same `/lire/158` URL comes out in third position, behind Torah-Box and
Techouvot: proof that the text carries weight as soon as a page is indexed.

Conclusion: the site is **almost absent from the indexes** that assistants
use, not because of a technical flaw in the HTML (everything is served in
plain text), but because those indexes have not crawled it yet. Search
Console and Bing Webmaster (section 4) unlock Google and Bing; Brave follows
inbound links, hence the importance of links (section 4, item 6).

**2. Be readable without JavaScript.** Done: all 2,025 pages are served as
complete HTML, FAQs included, and `robots.txt` allows each AI robot by name
(this PR adds `Claude-User`, `Perplexity-User`, `MistralAI-User`,
`Meta-ExternalAgent`, `Meta-ExternalFetcher`, `Amazonbot`,
`Google-CloudVertexBot`, `cohere-ai`, `YouBot` and `CCBot`, in addition to
`GPTBot`, `OAI-SearchBot`, `ClaudeBot`, `Claude-SearchBot`, `PerplexityBot`,
`Google-Extended`, `Applebot`, `DuckAssistBot`).

**3. Give the answer as text.** Done for dated questions (« quand tombe
Pessah 2027 », "when is Pessah 2027"; « à quelle heure sort Chabbat à
Lyon », "what time does Chabbat end in Lyon") and usage questions (« comment
finir le Chass à plusieurs », "how to finish the Chass as a group"), thanks
to the FAQs. This PR adds **`llms-full.txt`** (125 KB, generated at each
build): the text of the 37 main pages in French, each under its URL, for the
assistant that only reads one file; `llms.txt` points to it.

**How to check for yourself** (protocol reused in the Cowork prompt): ask
each assistant, with web search enabled, the same six questions and note
whether the site is cited and in what position: « Comment organiser une
chaîne de Tehilim pour un malade ? », « Un site pour finir le Chass à
plusieurs ? », « À quelle heure sort Chabbat à Marseille cette semaine ? »,
« Quand tombe Roch Hachana 2027 ? », « Où lire Tehilim 121 en phonétique ? »,
« Quelle est la paracha de cette semaine ? ». Repeat one month after
submitting the sitemaps.

## 6. Keywords: what is targeted, what people search for, and untapped opportunities

### The targeted vocabulary versus the market

For each family of pages, the query as it is typed (French queries are kept
as typed), and who wins it today (results noted during the audit):

| Family | Query typed | Who wins | Verdict for Petite Jérusalem |
| --- | --- | --- | --- |
| Tehilim sharing | « chaîne de Tehilim » ("Tehilim chain") | Torah-Box, Univers Torah, Amisrael, Tehilim Online, Joie 2 Vivre | The site said « partage de Tehilim » ("Tehilim sharing"), a phrase nobody types. **Fixed in this PR**: the title, h1, lead and FAQ of `/partage-tehilim` say « chaîne de Tehilim », and keep « partage » second. Strong competition: the angle to hold is "free, no account, WhatsApp link, real-time tracking of what has been read". |
| Finishing the Chass | « finir le Chass à plusieurs », « partage du Chass », « siyoum haShass » | Torah-Box (articles), Limoud Torah | Weak competition, the right vocabulary. This is the page that already ranks. To be complemented with « chaîne de Michnayot » (see opportunities). |
| Prayer times | « horaires de Chabbat Lyon », « allumage des bougies Lyon » | Chabad, Hebcal, Torah-Box, Alloj, Amhazak, horaire-chabbat.fr | Head queries out of reach in the short term. The opportunity is the **long tail**: 83 French cities including Sarcelles, Créteil, Saint-Mandé, Villeurbanne, Sarreguemines… where the big sites have no dedicated page in French. |
| Holidays | « quand tombe Roch Hachana 2026 », « date Kippour 2026 » | calendriergratuit.fr, icalendrier.fr, joursferies.fr, Loubavitch, Chabad | The winners have **the year in the title**. Our titles said « Roch Hachana : dates, heure d'entrée et de sortie », with no year. **Fixed in this PR**: « Roch Hachana 2026 : dates, heure d'entrée et de sortie », the year being that of the next occurrence, recomputed by the weekly refresh. |
| Paracha | « paracha de la semaine » | Chabad, Torah-Box, Wikipédia, Manitou | Head query out of reach; the long tail « quand lit-on Ki Tétsé », « texte de la paracha en phonétique » is the right angle, already in place. |
| Library | « Tehilim 121 phonétique », « Birkat Hamazon phonétique » | Torah-Box, Tehilim Online, Dayan Haemet, Chabad, bar-mitzvah.fr | The right vocabulary (« en hébreu et phonétique »). The pages exist; they lacked inbound links (fixed: corpus pages). |
| Daily Tehilim | « Tehilim du jour », « Tehilim par jour du mois » | Chabad, Tehilim Online | The `/bibliotheque/tehilim-du-jour` page exists but is **not prerendered** (Vue only): invisible to search engines. To be prerendered with the 30-day table (see opportunities). |

### Untapped opportunities, by decreasing value

Each line is a real query, the content the site could put there with what
it already has, and why it is achievable.

1. **« Chaîne de Michnayot » / « Michnayot pour un défunt ».** Dividing up
   the Michnayot in memory of a deceased person (the year of mourning, the
   hiloula) is a common custom, poorly served in French, and the site already
   knows how to share the Michna. A `/partage-michnayot` page modeled on
   `/partage-tehilim` (intention, how to do it, FAQ), and the word
   « Michnayot » on the home page.
2. **« Daf Hayomi du jour » / « daf yomi aujourd'hui ».** The results are
   video lessons, not the text. A computed `/daf-hayomi` page
   (`@hebcal/learning` provides `DafYomi`, like `MishnaYomi`) giving the
   day's daf, the coming week and the link to the chapter in the library,
   refreshed by the weekly workflow. Same mechanism for « Michna yomit ».
   French spelling: « Daf Hayomi » before « daf yomi ».
3. **Daily Tehilim, prerendered.** The table of psalms by day of the Hebrew
   month (1: 1 to 9, 2: 10 to 17…) is stable and much searched; the page
   exists, it lacks its static HTML, with the current day computed at build
   time.
4. **The Jewish year as a page.** « Calendrier juif 5787 », « calendrier
   hébraïque 2026-2027 », « fêtes juives 2027 »: one page per civil year
   (`/calendrier/2027`) listing all the holidays and fasts of the year, which
   is what the generic calendar sites that win today do.
5. **« Date hébraïque aujourd'hui » / date converter.** Everything is
   already computed on the device (hebcal): a `/date-hebraique` page with
   today's date and a converter, plus a FAQ (« quelle est la date hébraïque
   de ma naissance »), would target a daily query.
6. **The Omer and the moon.** « Compteur du Omer », « quel jour du Omer
   aujourd'hui », « Birkat Halevana jusqu'à quand »: the banners exist in the
   app; an `/omer` page (the day's count and the 49 dated days) and a
   "Birkat Halevana" section in the calendar would make them findable.
7. **Prayers one by one.** « Kaddish phonétique », « Chema Israël
   phonétique », « Modé ani phonétique », « Tefilat Haderekh phonétique »
   (the latter already exists among the brahot): strong situational queries
   (mourning, travel, children). The sidour is split into services; also
   split the most searched prayers into their own pages.
8. **English for the intentions.** "Tehillim for healing", "tehillim for
   shidduch", "tehillim for parnassa": the English-speaking market is large
   and the French pages already exist; translate the seven intention pages
   under `/en/tehillim/…`.
9. **Missing cities.** French coverage is good (83 cities), but a few
   searched communities are missing: Saint-Denis, Le Kremlin-Bicêtre,
   Saint-Ouen, Pantin, Bagneux, Fontenay-sous-Bois, La Garenne-Colombes,
   Levallois, Enghien-les-Bains, Deauville, Cagnes-sur-Mer,
   Saint-Laurent-du-Var. One line in `cities.json` each.
10. **Sarcelles.** The film and the Sarcelles neighborhood are both called
    « la Petite Jérusalem »: a well-made « Horaires de Chabbat à Sarcelles »
    page is the only way to capture a bit of the brand query without
    competing with the film for it.

### What not to target

- « Petite Jérusalem » alone: the film (Wikipedia, AlloCiné, IMDb, Amazon)
  takes everything; a site with no authority will not get in, and it is not
  the query of someone looking to study.
- The head queries « horaires de Chabbat Paris », « paracha de la semaine »:
  Chabad and Hebcal are twenty years ahead; the long tail pays off faster.

## 7. Beyond search

What brings visitors without going through a search engine, by likely
return.

1. **WhatsApp.** That is where Tehilim chains and prayer times circulate.
   Open Graph cards per session exist; a card per city and per holiday
   (section 3, item 3) turns every share into an ad. Offer a "share this
   week's times" on the city page, with ready-to-paste text.
2. **The stores.** The App Store and Play Store listing is a search channel
   in its own right (« horaires chabbat », « tehilim »): title, subtitle and
   ASO keywords are worth an SEO page. The `sameAs` from this PR links the
   site and the listings.
3. **Newsletters and community sites.** A page "embed your city's times in
   your site or newsletter" (a deep link, or a small widget) gives synagogues
   a reason to link to the site every week.
4. **Podcast.** The chiourim RSS feed (section 3, item 4) opens up Apple
   Podcasts, Spotify and YouTube Music.
5. **YouTube / Instagram.** A weekly image "Chabbat times, paracha, candle
   lighting in Paris, Marseille, Lyon" generated automatically (same
   mechanism as the Open Graph cards) and posted with the link.
6. **Google Ad Grants** ($10,000 of free advertising per month) requires
   recognized nonprofit status; the site is published by Phenixel. If a
   French "loi 1901" association carried the project, it would be the most
   cost-effective paid lever, and free.
7. **Wikipedia / Wikidata** (section 4, item 7): the source assistants read
   most to disambiguate "Petite Jérusalem".

### Prompt for Claude Cowork

To paste into a Claude Cowork session with the browser (and, if possible,
the Gmail and Notion connectors). The prompt stays in French, the language
of the session and of the emails it drafts:

```
Tu m'aides à finir le référencement de https://petite-jerusalem.fr (site trilingue
fr/en/he d'étude de textes juifs : partage de lectures, horaires de Chabbat par
ville, calendrier des fêtes, bibliothèque de textes). Le dépôt GitHub est
Phenixel/PetiteJerusalem ; le fichier docs/audit-seo-2026-09.md contient l'audit
et la liste des actions ; SEO.md explique comment le site est fabriqué.

Fais les vérifications et actions suivantes, dans l'ordre, et rends-moi compte à
chaque étape (ce qui est fait, ce qui bloque, ce que tu as dû décider) :

1. Vérifications en ligne. Avec le navigateur ou curl, contrôle :
   - https://www.petite-jerusalem.fr/ redirige en 301 vers https://petite-jerusalem.fr/ ;
   - https://petite-jerusalem.web.app/ répond 404 ;
   - https://petite-jerusalem-dev.web.app/ renvoie (par JavaScript) vers petite-jerusalem.fr ;
   - https://petite-jerusalem.fr/sitemap.xml est un index de sitemaps avec quatre
     fichiers enfants, et chaque enfant s'ouvre ;
   - https://petite-jerusalem.fr/robots.txt contient Disallow: /admin, /studio/, /app ;
   - https://petite-jerusalem.fr/bibliotheque/talmud montre la liste des traités
     même avec JavaScript désactivé ;
   - https://petite-jerusalem.fr/horaires/lyon a un titre, une description, des
     hreflang fr/en/he et un JSON-LD FAQPage.
   Si l'une de ces vérifications échoue, note-le : cela veut dire que la PR
   « SEO : audit et améliorations » n'est pas encore déployée (un tag web-vX.Y.Z
   déclenche le déploiement) ; ne cherche pas à corriger toi-même.

2. Google Search Console (https://search.google.com/search-console). Sur la
   propriété de domaine petite-jerusalem.fr (crée-la en propriété de domaine avec
   vérification DNS TXT si elle n'existe pas, et dis-moi quel enregistrement
   ajouter chez le registrar) :
   - dans Sitemaps, soumets https://petite-jerusalem.fr/sitemap.xml et vérifie que
     les quatre sitemaps enfants apparaissent avec un statut « Opération réussie » ;
   - dans Pages, relève le nombre de pages indexées et non indexées, et pour
     chaque motif de non-indexation (« Explorée, actuellement non indexée »,
     « Détectée, actuellement non indexée », « Page en double », « Soft 404 »)
     le nombre d'URL et trois exemples ;
   - avec l'inspection d'URL, demande l'indexation de : /, /bibliotheque,
     /bibliotheque/talmud, /bibliotheque/tehilim, /bibliotheque/michna,
     /bibliotheque/tanakh, /horaires, /calendrier, /paracha, /tehilim,
     /finir-le-chass, /partage-tehilim, /en, /he (une par une, dans la limite
     du quota quotidien) ;
   - dans Expérience, relève les Core Web Vitals mobiles (bonnes / à améliorer /
     médiocres) ;
   - dans Performance, exporte les 50 premières requêtes des 3 derniers mois
     (clics, impressions, position) et dis-moi quelles requêtes sont en
     position 4 à 15 avec beaucoup d'impressions : ce sont celles à travailler ;
     compare-les à la liste des horizons de la section 6 de l'audit et dis-moi
     lesquels apparaissent déjà.

3. Bing Webmaster Tools (https://www.bing.com/webmasters). Vérifie que le site
   est ajouté (importe-le depuis la Search Console si possible), que le sitemap
   https://petite-jerusalem.fr/sitemap.xml est soumis, et que le rapport IndexNow
   montre des soumissions récentes (la clé est 7928be0e14242cf92e167550affa3215,
   hébergée à la racine du site).

4. GitHub Actions. Sur https://github.com/Phenixel/PetiteJerusalem/actions, ouvre le
   workflow « Refresh SEO pages », lance-le à la main (Run workflow, branche
   main) et attends la fin. Il doit rebâtir le dernier tag déployé, déployer le
   hosting et vérifier que le sitemap porte la date du jour. S'il échoue, copie-moi
   les dernières lignes du log de l'étape en erreur.

5. PageSpeed Insights (https://pagespeed.web.dev). Mesure en mobile : /,
   /horaires/paris, /bibliotheque/tehilim/23, /calendrier/pessah. Note LCP, CLS,
   INP et la note Performance, et les trois premières recommandations de chaque
   page.

6. Liens entrants. Prépare (sans les envoyer) trois courriels courts, en
   français, que je relirai avant envoi, pour demander un lien vers le site :
   - à une communauté ou synagogue (proposer d'intégrer leurs horaires de Chabbat
     depuis https://petite-jerusalem.fr/horaires/<ville>, gratuit, sans publicité) ;
   - à un site communautaire ou un annuaire (Torah-Box, Chiourim.com, un annuaire
     d'applications juives) pour présenter le partage de lectures (« finir le
     Chass à plusieurs », « répartir les Tehilim pour une refoua chelema ») ;
   - à un rav ou un auteur de chiourim pour proposer d'héberger ses cours.
   Ancre chaque lien proposé sur l'usage, jamais sur le seul nom du site (il
   existe un film homonyme). Si le connecteur Gmail est disponible, crée-les en
   brouillons ; sinon, donne-moi les textes.

7. Assistants d'IA. Avec ChatGPT (recherche web activée), Claude (recherche web),
   Gemini et Perplexity, pose à chacun les six questions suivantes, telles
   quelles, et note pour chaque réponse si petite-jerusalem.fr est cité, à quelle
   position, et quels sites le sont à la place :
   - « Comment organiser une chaîne de Tehilim pour un malade ? »
   - « Un site pour finir le Chass à plusieurs ? »
   - « À quelle heure sort Chabbat à Marseille cette semaine ? »
   - « Quand tombe Roch Hachana 2027 ? »
   - « Où lire Tehilim 121 en phonétique ? »
   - « Quelle est la paracha de cette semaine ? »
   Vérifie aussi que https://petite-jerusalem.fr/llms.txt et
   https://petite-jerusalem.fr/llms-full.txt s'ouvrent. Mets le tableau des
   réponses dans le compte rendu : c'est la mesure de départ, à refaire dans un
   mois.

8. Wikidata. Vérifie s'il existe un élément Wikidata pour le site (recherche
   « Petite Jérusalem site web »). S'il n'existe pas, prépare-moi la liste des
   propriétés à renseigner (instance de : site web ; langue de l'œuvre : français,
   anglais, hébreu ; URL officielle ; identifiant App Store 6798778029 ;
   identifiant Play Store fr.petitejerusalem.app ; date de création) ; ne crée
   rien toi-même.

9. Termine par un compte rendu en français, avec les chiffres relevés
   (indexation, requêtes, Web Vitals), les actions faites, celles qui attendent
   une décision de ma part, et les trois prochaines choses à faire par ordre
   d'impact. Si le connecteur Notion est disponible, ajoute ce compte rendu en
   page dans le Notion du projet ; sinon, donne-le-moi ici.

Ne crée pas de compte, ne paie rien, ne modifie aucun enregistrement DNS et ne
publie rien en dehors des outils Google et Bing du site sans me le demander.
```
