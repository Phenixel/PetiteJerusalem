# SEO Petite Jérusalem

Comment le site est rendu trouvable par les moteurs de recherche **et** par
les assistants IA (ChatGPT, Claude, Perplexity), et les étapes manuelles qui
restent pour finir le travail.

## Pourquoi il était invisible (le diagnostic)

1. **`sitemap.xml` et `robots.txt` pointaient sur un domaine mort.** Toutes
   les URL utilisaient `petite-jerusalem.web.app`, qui répond **404**. Google
   recevait un sitemap plein de liens morts. Corrigé : les deux utilisent
   désormais `petite-jerusalem.fr`.
2. **Le corps du HTML servi était vide** (`<div id="app"></div>`). Les robots
   qui n'exécutent pas JavaScript (Bing, GPTBot, ClaudeBot, PerplexityBot…) ne
   voyaient aucun contenu. Corrigé : le build prérend maintenant un vrai
   `<body>` par page (voir plus bas).
3. **Collision de nom de marque.** « Petite Jérusalem » est aussi un film de
   2005 qui a sa page Wikipédia : un site neuf sans autorité ne peut pas
   encore gagner son propre nom. On garde le nom et on mise sur des textes
   descriptifs, orientés tâche, et sur des liens entrants.
4. **Décalage de vocabulaire.** Les textes disaient « centre spirituel
   numérique » ; les gens cherchent « finir le Chass », « répartir les
   Tehilim », « refoua chelema ». Textes et pages d'atterrissage réécrits
   autour de ces termes réels.

## Une URL par langue

Le site est écrit en français, en anglais et en hébreu, mais il a longtemps
eu **une seule URL par page**, la langue étant choisie dans le navigateur
(localStorage, puis `navigator.language`). Googlebot recevait la version
française et n'avait aucun moyen de découvrir les deux autres : aucune adresse
ne les portait. Les traductions anglaise et hébraïque des pages d'atterrissage
existaient déjà dans `seoPages.ts` et n'étaient servies à personne.

Le schéma standard s'applique désormais, piloté par
`src/content/seoLocales.ts` :

- Le français reste à la racine (c'est le jeu d'URL historique, et le
  `x-default`) ; l'anglais et l'hébreu prennent un préfixe, et les segments
  sont traduits, parce qu'un anglophone cherche « shabbat times », pas
  « horaires » :

  | fr                   | en                       | he                        |
  | -------------------- | ------------------------ | ------------------------- |
  | `/horaires/lyon`     | `/en/shabbat-times/lyon` | `/he/zmanei-shabbat/lyon` |
  | `/calendrier/pessah` | `/en/holidays/passover`  | `/he/chagim/pesach`       |
  | `/paracha`           | `/en/parasha`            | `/he/parasha`             |
  | `/finir-le-chass`    | `/en/finish-the-shas`    | `/he/siyum-hashas`        |

  Les slugs de villes ne sont **pas** traduits : ce sont des noms propres, et
  un slug par ville donne un seul catalogue au lieu de trois qui dériveraient.

- Le prérendu écrit `lang` et `dir` sur le document (`dir="rtl"` pour
  l'hébreu), le `og:locale` propre à la page, et les liens `hreflang` croisés
  dans le `<head>` et dans `sitemap.xml` (`xhtml:link`). Une page qui n'existe
  pas dans une langue n'y est simplement pas déclarée, plutôt que de promettre
  une traduction qui n'existe pas.
- Les routes localisées du routeur sont générées à partir de la même table :
  un segment ne peut donc jamais diverger entre le routeur et les fichiers
  générés. Une URL préfixée impose sa langue (`router.beforeEach`, en
  attendant le chunk de la locale pour que le titre ne soit pas français un
  instant) ; les URL sans préfixe ne touchent à rien, le comportement
  historique est inchangé.
- Le sélecteur de langue suit l'adresse : sur une page traduite il navigue
  vers l'URL sœur, ailleurs il change seulement le texte.
- Les liens internes vers les sections traduites suivent **l'espace de langue
  de la session** (`useLocalePath`) : la dernière URL préfixée ouverte, ou le
  dernier choix du sélecteur. Traverser une page à adresse unique
  (Bibliothèque, chiourim, profil) ne fait pas perdre le `/en` des liens
  suivants, l'URL que partage un visiteur reste donc dans sa langue. L'espace
  vaut pour la session seulement, jamais stocké : un nouveau lancement est
  décidé par l'adresse seule, et une session qui n'a jamais touché `/en` ni
  `/he` n'est jamais préfixée.

Traduits aujourd'hui : l'accueil, les pages d'atterrissage et légales (leur
contenu `en`/`he` existait déjà), `/horaires` et ses 242 pages de villes,
`/calendrier` et ses 15 pages de fêtes, `/zmanim` et `/paracha`. Les pages de
Tehilim par intention et les ~1200 pages de lecture de la Bibliothèque restent
en français seul pour l'instant, et ne déclarent aucun `hreflang` plutôt qu'un
faux.

Les familles générées gardent leurs phrases dans `zmanimSeoStrings.ts`,
`zmanimGuideStrings.ts` et `parashaStrings.ts`, un jeu rédigé par langue (pas
une transposition littérale : « sof zman shema » est ce qui se cherche en
anglais). Les noms de villes et de pays vivent dans `zmanimCities.ts`, les
noms et slugs de fêtes dans `zmanimFestivals.ts`.

**Titres de page et barre verticale.** Les titres à l'exécution passent par
`t()`, et vue-i18n lit `|` comme un séparateur de pluriel : chaque
`seo.*Title` était tronqué à la première barre, « Petite Jerusalem |
Partager… » partait en « Petite Jerusalem ». Les messages du bloc `seo`
l'échappent donc (`{'|'}`), et `src/__tests__/seoTitles.test.ts` tient la
ligne.

## Comment fonctionne le prérendu

L'app est une SPA Vue sur Firebase Hosting. Nous ne faisons **pas** de SSR à
l'exécution (l'app touche `localStorage` et Firebase à l'import, ce qui casse
sous Node). À la place :

- `src/content/seoPages.ts` : la **source unique de vérité** pour le titre,
  la description, le `bodyHtml` explorable et le JSON-LD de chaque page
  indexable. Importé à la fois par l'app Vue et par l'étape de build, pour que
  le balisage ne dérive jamais.
- `scripts/prerender-seo.mjs` (lancé après `vite build`, charge le module TS
  via `jiti`) écrit un fichier HTML statique par route dans `dist/`, avec un
  `<head>` propre à la route, le JSON-LD et un vrai `<body>`. Avec
  `cleanUrls: true`, `/share-reading` est servi directement depuis
  `dist/share-reading.html`.
  - Il écrit aussi **`dist/app.html`** : une coquille vide, cible du rewrite
    attrape-tout, pour que les routes profondes de l'app (`/profile`, …) ne
    fassent jamais clignoter le contenu de l'accueil (`firebase.json` :
    `"**"` vers `/app.html`). Ses balises canonical et `og:url` sont
    **retirées** (`buildAppShell` dans `seoPages.ts`) : la coquille sert
    toutes les routes non prérendues, et garder la canonique de l'accueil
    faisait passer chacune d'elles pour un doublon de `/` (Search Console :
    « Page en double, Google a choisi une URL canonique différente »). Les
    vues Vue posent la bonne canonique au montage (`seoService`).
  - Il régénère aussi les sitemaps à partir des mêmes listes de pages :
    **`dist/sitemap.xml`** est un _index_ de sitemaps qui pointe sur un
    fichier par famille de pages (`sitemap-pages.xml`,
    `sitemap-bibliotheque.xml`, `sitemap-horaires.xml`,
    `sitemap-calendrier.xml`), pour que la Search Console rapporte l'indexation
    famille par famille. Chaque URL porte un **vrai `lastmod`** : la date du
    dernier commit qui a touché le fichier dont la page est faite (le fichier
    de texte pour une page de lecture, `seoPages.ts` pour une page de contenu),
    lue en un seul `git log` par `scripts/lib/lastmod.mjs`. Les pages
    calculées (horaires, calendrier, paracha, parachiot datées) portent la date
    du build, parce qu'elles changent réellement à chaque build. Sans
    historique git (clone superficiel), tout se replie sur la date du build ;
    les workflows de déploiement font donc leur checkout avec
    `fetch-depth: 0`.
- `src/content/zmanimSeoPages.ts` : tout ce qui a besoin de dates ou d'heures
  calculées, prérendu depuis `@hebcal/core` au moment du build :
  - **`/horaires`** (Paris) : douze semaines d'allumage et de havdala, la
    table complète des zmanim du jour (alot, michéyakir, netz, sof zman Chema
    et Tefila selon les deux opinions, 'hatsot, min'ha guedola et ketana,
    plag, chkia, tseit, 'hatsot halayla), la paracha de chaque Chabbat à
    venir liée à sa page Bibliothèque, et l'annuaire de toutes les pages de
    villes groupées par pays.
  - **`/horaires/<ville>`**, une par ville de `src/datas/cities.json` (242,
    toutes sauf Paris, dont la page _est_ `/horaires`) : les mêmes douze
    semaines et la même table de zmanim calculées aux coordonnées de la ville,
    plus ses six villes les plus proches avec leurs distances. Jérusalem en
    fait partie : l'allumage y est 40 minutes avant le coucher du soleil, et
    `candleLightingMinutes` dans `zmanimService` porte cet usage local (18
    minutes partout ailleurs). La liste des communautés mises en avant vit
    dans `src/content/zmanimCities.ts` (`FEATURED_CITY_NAMES`), avec les slugs
    partagés avec le routeur.
  - **`/calendrier`** : les fêtes de l'année hébraïque en cours et de la
    suivante avec heures d'entrée et de sortie, plus une table « grandes fêtes
    sur sept années hébraïques ».
  - **`/calendrier/<fete>`**, une par fête de `src/content/zmanimFestivals.ts`
    (15 : roch-hachana, yom-kippour, souccot, simhat-torah, hanouka,
    tou-bichvat, jeune-esther, pourim, pessah, lag-baomer, chavouot, et les
    jeûnes) : ses dates sur six années à venir, en dates civiles et
    hébraïques, heures d'entrée et de sortie quand c'est un Yom Tov, et une
    FAQ « Quand tombe X <année> ? » par année. La route `/calendrier/:fete`
    est aussi un vrai comportement de l'app : CalendarPage résout le slug,
    ouvre l'année qui porte la prochaine occurrence et la met en évidence.
    Tout cela vit dans son propre module, pas dans `seoPages.ts`, pour que
    hebcal reste hors des chunks Vue qui importent `seoPages` (ContentPage,
    TehilimPage) ; seuls le prérendu, `indexnow.mjs` et les tests le
    chargent. Chaque ligne est datée, le contenu reste donc vrai entre deux
    déploiements, mais il faut **déployer au moins toutes les quelques
    semaines** pour que les tables d'horaires à venir gardent de l'avance sur
    le calendrier. `/horaires/:ville` est aussi un vrai comportement de
    l'app : ZmanimPage résout le slug contre le catalogue de villes et calcule
    les horaires en direct.
- `src/content/parashaSeoPages.ts` : le hub **`/paracha`** (la paracha de la
  semaine, puis le calendrier daté de tout le cycle, chaque paracha liée à son
  texte dans la Bibliothèque) et la phrase datée injectée dans chacune des 54
  pages de lecture de paracha (« Cette paracha se lit le Chabbat 31 octobre
  2026, puis le Chabbat 20 novembre 2027 »), ce qui fait que « quand lit-on
  Ki Tétsé » aboutit sur une page qui existait déjà. Vezot Haberakha n'est
  jamais lue un Chabbat ordinaire, elle est donc datée depuis Sim'hat Torah.
  Le calendrier lui-même vit dans `src/content/parashaCalendar.ts`
  (dailyCycles seulement, pas de `seoPages`), partagé avec
  `src/views/Library/ParashaPage.vue`, qui le recalcule en direct pour les
  visiteurs. C'est la page la plus sensible au déploiement du site : son
  chapeau et sa FAQ nomment le Chabbat pour lequel ils ont été construits, ils
  ne deviennent donc jamais faux, mais ils vieillissent. Un déploiement
  hebdomadaire fait que « cette semaine » veut vraiment dire cette semaine.
- `guidePages` dans `src/content/seoPages.ts` tient les guides intemporels
  qui n'ont besoin d'aucun calcul, aujourd'hui **`/zmanim`** (ce que marque
  chaque zman, les deux opinions, comment il est calculé), rendus pour les
  humains par `src/views/SeoGuidePage.vue` à partir du même `bodyHtml`.
- **Rien de tout cela ne part dans l'app native.** Tout le contenu SEO
  prérendu est réservé au web : `scripts/prune-native-bundle.mjs` (lancé par
  `npm run app:build`, entre `vite build` et `cap sync`) retire du bundle
  Capacitor toutes les pages `.html` prérendues, `sitemap.xml` et ses quatre
  sitemaps enfants (`sitemap-pages.xml`, `sitemap-bibliotheque.xml`,
  `sitemap-horaires.xml`, `sitemap-calendrier.xml`), `robots.txt`,
  `llms.txt`, `llms-full.txt`, `og-image.jpg`, la clé IndexNow
  (`7928be0e14242cf92e167550affa3215.txt`), `texts/manifest.json`,
  `app-version.json` et le dossier `.well-known/`, et remplace son entrée
  `index.html` par la coquille nue (`app.html`), pour que l'app ne fasse
  jamais clignoter du texte SEO au lancement. La navigation dans l'app est
  entièrement côté client et ne charge de toute façon jamais ces fichiers ;
  les retirer économise aussi ~79 Mo de HTML dans l'APK et l'IPA. Un test
  verrouille ce comportement (`src/__tests__/pruneNativeBundle.test.ts`).
- **`/bibliotheque/<corpus>`** (`tehilim`, `michna`, `talmud`, `tanakh`,
  `sidour`, `brahot`) : une page statique par corpus qui liste chaque livre
  en lien, groupés par seder, sefer ou livre (`buildCorpusBody` dans
  `src/content/etudeTexts.ts`), avec un `ItemList` en JSON-LD. Avant, la liste
  des livres n'existait que dans la vue Vue, un robot n'avait donc aucun chemin
  de la bibliothèque vers les ~1200 pages de lecture (les pages brahot et
  sidour n'avaient aucun lien entrant). `StudyPage.vue` pose le même titre et
  la même description en français à l'exécution, pour que la page rendue par
  Googlebot corresponde au HTML servi.
- `src/views/ContentPage.vue` rend les pages d'atterrissage et légales
  longues (`landingPages` dans `seoPages.ts` : `/finir-le-chass`,
  `/partage-tehilim`, `/confidentialite`, `/a-propos`, `/mentions-legales`)
  à partir du même `bodyHtml` : un humain et un robot reçoivent un contenu
  identique.
- `functions/src/index.ts` (`socialPreview`) injecte un `<head>` par page et
  un petit `<body>` pour les routes **dynamiques** (sessions individuelles,
  chiourim, auteurs) qui ne peuvent pas être connues au build.

Pages prérendues et indexables (~2025 au total, toutes listées dans les
sitemaps générés) : les pages statiques déclarées dans `seoPages.ts`, `/`,
`/share-reading`, `/bibliotheque`, `/chiourim`, les pages d'atterrissage et
légales ci-dessus, `/zmanim`, `/paracha`, le hub des Tehilim par intention et
ses pages d'intention, `/horaires` et ses 242 pages de villes, `/calendrier`
et ses 15 pages de fêtes (depuis `zmanimSeoPages.ts`, chacune en trois
langues), plus les six pages de corpus et les pages de lecture de la
Bibliothèque générées par corpus, livre et chapitre par `prerender-seo.mjs`.
(`/login` est `noindex` ; les anciennes URL `/etude` redirigent en 301 vers
`/bibliotheque` dans `firebase.json`.)

Données structurées émises : `WebSite`, `Organization`, `WebApplication`,
`HowTo`, `Article`, `FAQPage`, `BreadcrumbList`, `ItemList`.

`public/llms.txt` décrit le site pour les agents IA, et le build écrit
**`dist/llms-full.txt`** à côté (`buildLlmsFull` dans `prerender-seo.mjs`) :
le texte des ~37 pages françaises principales (accueil, pages d'atterrissage,
guides, Tehilim par intention, `/horaires`, `/calendrier` et les fêtes,
`/paracha`), chacune sous son URL, pour un assistant qui lit un seul fichier.
Les pages de lecture en sont exclues (des dizaines de mégaoctets).
`robots.txt` nomme explicitement chaque robot IA (les récupérateurs au moment
de la recherche comme `OAI-SearchBot`, `Claude-User`, `Perplexity-User`,
`MistralAI-User`, et les robots d'entraînement comme `GPTBot`, `ClaudeBot`,
`Google-Extended`, `CCBot`) ; quel index chaque assistant interroge
réellement, et comment vérifier que le site y apparaît, est dans
`docs/audit-seo-2026-09.md`, section 5.

Les pages dynamiques servies par `socialPreview` portent aussi du JSON-LD :
un chiour est un `AudioObject` (auteur, durée ISO 8601, `contentUrl`,
gratuit), les sessions et les chiourim ont un `BreadcrumbList`.

`index.html` redirige aussi les hôtes techniques Firebase
(`petite-jerusalem-dev.web.app`, `.firebaseapp.com`) vers le domaine canonique
avec un minuscule script inline : le même site y répond (c'est ce que
`deploy.yml` interroge pour vérifier une release) et serait sinon un doublon.
Les canaux de preview (`petite-jerusalem-dev--pr123-xxx.web.app`) et l'app
native (origine `localhost`) ne sont pas touchés.

## Garder les pages datées fraîches (rafraîchissement hebdomadaire)

`/paracha` nomme « cette semaine », les pages de villes couvrent douze
semaines à partir du build, les FAQ des fêtes sont datées. Elles sont vraies
au moment du build et ne le restent que tant que le build est récent. Les
releases seules (`deploy.yml`, sur un tag) ne le garantissaient pas, donc
**`.github/workflows/refresh-seo.yml`** tourne le dimanche et le mercredi à
03:00 UTC (et à la demande) : il rebuilde le **dernier tag déployé** (pas
`main` : le site reste à la version publiée, seules les dates bougent),
déploie le hosting seul, vérifie que le `sitemap.xml` servi porte la date du
jour, et prévient IndexNow. Un groupe `concurrency` l'empêche de s'entrelacer
avec une release. Si le workflow est rouge deux semaines de suite, le texte
« cette semaine » vieillit : vérifier Actions après un dimanche.

## Déploiement et liste de vérification après déploiement (manuel, réservé au propriétaire)

Après `npm run build` et `firebase deploy` :

1. **Tester les rewrites** (déjà vérifiés en local via l'émulateur hosting) :
   ```bash
   curl -s https://petite-jerusalem.fr/finir-le-chass | grep -o '<title>[^<]*</title>'
   curl -s https://petite-jerusalem.fr/sitemap.xml | head
   curl -s -o /dev/null -w "%{http_code}\n" https://petite-jerusalem.fr/profile   # 200 (app.html)
   ```
2. **Google Search Console** (https://search.google.com/search-console) :
   - Ajouter la propriété `petite-jerusalem.fr` (propriété de domaine,
     vérification par enregistrement DNS TXT).
   - Soumettre `https://petite-jerusalem.fr/sitemap.xml` (un index de
     sitemaps : les quatre sitemaps enfants apparaissent dessous, chacun avec
     sa propre couverture).
   - Utiliser **Inspection de l'URL, puis Demander une indexation** pour `/`,
     `/share-reading`, `/finir-le-chass`, `/partage-tehilim`,
     `/bibliotheque`, `/bibliotheque/talmud`, `/bibliotheque/tehilim`,
     `/horaires`, `/calendrier`, `/zmanim`, `/en`, `/he`.
3. **Bing Webmaster Tools** (https://www.bing.com/webmasters) : ajouter le
   site, soumettre le sitemap. (Bing alimente aussi la recherche de ChatGPT.)
4. Vérifier que l'ancien `petite-jerusalem.web.app` redirige vers `.fr` ou
   reste en 404 (il ne doit pas servir un doublon du site).

## Être trouvé par les assistants IA

Les LLM recommandent un site quand il est (a) explorable en texte (c'est
maintenant le cas) et (b) présent dans leur corpus d'entraînement ou de
récupération, ce qui demande surtout d'**être indexé et lié depuis
ailleurs**. Concrètement :

- Obtenir des liens entrants depuis des sites communautaires juifs, des
  lettres d'information de synagogues et de kehilot, des annuaires d'étude de
  la Torah et des pages d'associations. Une poignée de vrais liens est le
  levier le plus fort pour un domaine neuf.
- Nommer les cas d'usage exacts dans ces liens (« un site pour finir le Chass
  à plusieurs », « répartir les Tehilim pour une refoua chelema ») : ce texte
  d'ancre est ce que Google comme les LLM associent au site.
- Garder `llms.txt` et les réponses des FAQ à jour ; c'est le texte qu'un
  assistant a le plus de chances de citer.

## IndexNow (Bing, Yandex, recherche ChatGPT)

Le site est configuré pour **IndexNow**, qui prévient instantanément Bing et
Yandex des URL nouvelles ou modifiées (Bing alimente aussi la recherche web de
ChatGPT). Google ne l'utilise pas.

- La clé de propriété est hébergée dans `public/<clé>.txt` (servie à la racine
  du domaine).
- Soumettre les URL indexables après un déploiement avec **`npm run
  indexnow`** (`scripts/indexnow.mjs`, liste d'URL lue dans les sitemaps que le
  build a écrits dans `dist/`, pages de lecture comprises). `deploy.yml` et
  `refresh-seo.yml` le lancent après chaque mise en ligne du hosting.

## Audit

`docs/audit-seo-2026-09.md` tient l'audit de septembre 2026 : ce qui a été
trouvé sur les pages construites, ce que la PR qui l'accompagne a corrigé, ce
qui reste à faire dans le code, et les actions manuelles (Search Console,
Bing, liens entrants) avec un prompt prêt à coller pour Claude Cowork.

## Ajouter une page SEO

Ajouter une entrée à `appPages` (vue Vue existante) ou à `landingPages`
(nouvelle route ContentPage, plus une route dans `src/router/routes.ts`) dans
`src/content/seoPages.ts`. Le sitemap, le fichier statique et le rendu Vue
suivent automatiquement. Lancer `npm run build` et vérifier
`dist/<fichier>.html`.
