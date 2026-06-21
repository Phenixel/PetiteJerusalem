/**
 * Single source of truth for SEO content of statically-known pages.
 *
 * Petite Jérusalem is a Vue SPA: the served HTML body is an empty
 * `<div id="app"></div>`, so crawlers that don't run JavaScript (Bing, the AI
 * crawlers like GPTBot, ClaudeBot, PerplexityBot…) see no content at all. This
 * module holds the real, crawlable body content + per-page metadata + JSON-LD
 * for every page we want indexed.
 *
 * It is imported from TWO places so the markup never drifts:
 *  - `scripts/prerender-seo.mjs` (Node, via jiti) writes one static HTML file
 *    per route into `dist/` at build time, so that file already contains the
 *    body, so a non-JS crawler sees the full content.
 *  - `src/views/ContentPage.vue` renders the long-form landing pages
 *    (`/finir-le-chass`, `/partage-tehilim`) from the very same `bodyHtml`, so
 *    a human visitor and a crawler get identical content.
 *
 * Keep this module free of any browser- or Node-only API (no `window`, no
 * `localStorage`, no `node:*`): it must run in both environments.
 */

export const SITE_URL = "https://petite-jerusalem.fr";
export const SITE_NAME = "Petite Jérusalem";
export const OG_IMAGE = `${SITE_URL}/og-image.jpg`;

/** Escape a value so it is safe inside a double-quoted HTML attribute. */
export function escapeAttr(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type SeoPage = {
  /** Output file inside `dist/` (served thanks to `cleanUrls: true`). */
  file: string;
  /** Route path, also used to build the canonical URL. */
  path: string;
  title: string;
  description: string;
  /** Overrides the default `index, follow` when set (e.g. `noindex, follow`). */
  robots?: string;
  /**
   * Crawlable HTML injected inside `<div id="app">…</div>`. For SPA pages it is
   * pre-paint content that Vue replaces on mount; for landing pages it is the
   * actual content `ContentPage.vue` renders, so the two always match.
   */
  bodyHtml: string;
  /** schema.org objects emitted as <script type="application/ld+json"> in <head>. */
  jsonLd?: Record<string, unknown>[];
  /** Sitemap hints. `false` keeps the page out of the sitemap (e.g. /login). */
  sitemap?: { priority: number; changefreq: string } | false;
};

// ---- Shared HTML building blocks ---------------------------------------

const breadcrumb = (items: { name: string; path: string }[]): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: it.name,
    item: `${SITE_URL}${it.path}`,
  })),
});

const faqJsonLd = (faq: { q: string; a: string }[]): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

/** Render a FAQ block both as visible HTML and (separately) as FAQPage JSON-LD. */
const faqHtml = (faq: { q: string; a: string }[]): string => `
  <section class="seo-section" aria-labelledby="faq-title">
    <h2 id="faq-title">Questions fréquentes</h2>
    <dl>
      ${faq.map((f) => `<dt>${f.q}</dt>\n      <dd>${f.a}</dd>`).join("\n      ")}
    </dl>
  </section>`;

/** Internal-link footer injected into every static page for crawlable site links. */
export const staticFooterHtml = `
  <footer class="seo-footer" role="contentinfo">
    <nav aria-label="Navigation du site">
      <a href="/">Accueil</a>
      <a href="/share-reading">Partage de lectures</a>
      <a href="/etude">Étude</a>
      <a href="/chiourim">Chiourim</a>
      <a href="/finir-le-chass">Finir le Chass</a>
      <a href="/partage-tehilim">Partage de Tehilim</a>
    </nav>
    <p>Petite Jérusalem : étudier et partager la Torah, ensemble. Gratuit et en français.</p>
  </footer>`;

// ---- Pages backed by an existing Vue view (static body = pre-paint) -----

export const appPages: SeoPage[] = [
  {
    file: "index.html",
    path: "/",
    title: "Petite Jérusalem | Partager l'étude de la Torah et finir le Chass à plusieurs",
    description:
      "Plateforme gratuite en français pour étudier et partager la Torah à plusieurs : répartissez le Talmud pour finir le Chass, lisez les Tehilim à plusieurs pour une refoua chelema ou à la mémoire d'un proche, suivez la progression jusqu'au siyoum.",
    sitemap: { priority: 1.0, changefreq: "weekly" },
    bodyHtml: `
  <main class="seo-article">
    <h1>Étudier et partager la Torah, à plusieurs</h1>
    <p class="seo-lead">
      Petite Jérusalem est une plateforme <strong>gratuite et en français</strong> pour organiser
      l'étude collective des textes juifs. Répartissez un texte entre plusieurs personnes, réservez
      vos passages et suivez la progression de tous jusqu'au siyoum, où que vous soyez.
    </p>

    <section class="seo-section">
      <h2>Que pouvez-vous faire ?</h2>
      <ul class="seo-cards">
        <li>
          <h3><a href="/share-reading">Partage de lectures</a></h3>
          <p>Créez une session, choisissez un texte (Talmud / Guemara, Tehilim, Michna, Tanakh) et
          répartissez les passages entre les participants.</p>
        </li>
        <li>
          <h3><a href="/etude">Étude libre</a></h3>
          <p>Lisez les Tehilim, la Michna, le Talmud et le Tanakh en ligne, en hébreu et en
          phonétique.</p>
        </li>
        <li>
          <h3><a href="/chiourim">Chiourim</a></h3>
          <p>Écoutez des cours et leçons de Torah partagés par la communauté, par rav ou par thème.</p>
        </li>
      </ul>
    </section>

    <section class="seo-section">
      <h2>Pensé pour vos limoud collectifs</h2>
      <ul>
        <li><a href="/finir-le-chass">Finir le Chass à plusieurs</a> : se répartir les massekhtot et les dapim du Talmud Bavli jusqu'au siyoum haShass.</li>
        <li><a href="/partage-tehilim">Partage de Tehilim</a> : répartir les 150 Psaumes pour une refoua chelema (guérison), un ilouï nechama (à la mémoire d'un défunt) ou une hatslakha.</li>
        <li>Organiser un limoud à la mémoire d'un proche, pour une hiloula ou pour la réussite d'un événement.</li>
      </ul>
      <p><a class="seo-cta" href="/share-reading">Créer une session de partage</a></p>
    </section>
  </main>`,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web",
        inLanguage: "fr-FR",
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        description:
          "Plateforme gratuite pour étudier et partager la Torah à plusieurs : se répartir le Talmud pour finir le Chass, lire les Tehilim à plusieurs, suivre la progression d'un limoud collectif.",
      },
    ],
  },
  {
    file: "share-reading.html",
    path: "/share-reading",
    title: "Partage de lectures : organiser une étude de Torah à plusieurs | Petite Jérusalem",
    description:
      "Créez une session de partage : choisissez un texte (Talmud, Tehilim, Michna, Tanakh), répartissez les passages entre les participants, partagez le lien et suivez la progression du limoud jusqu'au siyoum.",
    sitemap: { priority: 0.9, changefreq: "daily" },
    bodyHtml: `
  <main class="seo-article">
    <h1>Partage de lectures : étudier la Torah à plusieurs</h1>
    <p class="seo-lead">
      Le partage de lectures permet de <strong>se répartir un texte entre plusieurs personnes</strong>
      pour le terminer ensemble : finir le Chass, lire un sefer Tehilim complet, étudier la Michna ou
      le Tanakh. Chacun réserve ses passages, les lit à son rythme, et tout le monde suit l'avancée
      commune.
    </p>

    <section class="seo-section">
      <h2>Comment ça marche</h2>
      <ol>
        <li>Créez une session et donnez-lui un nom (par exemple « Finir le Chass à la mémoire de… »).</li>
        <li>Choisissez le type de texte (Talmud / Guemara, Tehilim, Michna, Tanakh) et les parties à inclure.</li>
        <li>Partagez le lien (ou le QR code) avec votre communauté, votre famille ou vos amis.</li>
        <li>Chaque participant réserve les passages qu'il prend en charge, même sans compte.</li>
        <li>Suivez la progression en temps réel jusqu'à ce que le texte soit terminé : c'est le siyoum.</li>
      </ol>
      <p><a class="seo-cta" href="/share-reading/new-session">Créer une session</a></p>
    </section>

    <section class="seo-section">
      <h2>Exemples d'utilisation</h2>
      <ul>
        <li><a href="/finir-le-chass">Finir le Chass</a> (terminer le Talmud) à plusieurs.</li>
        <li><a href="/partage-tehilim">Partager les Tehilim</a> pour un malade (refoua chelema) ou à la mémoire d'un proche.</li>
        <li>Étudier la Parasha de la semaine en groupe.</li>
        <li>Préparer un siyoum pour une hiloula ou un événement familial.</li>
      </ul>
    </section>
  </main>`,
    jsonLd: [
      breadcrumb([
        { name: "Accueil", path: "/" },
        { name: "Partage de lectures", path: "/share-reading" },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: "Organiser un partage de lecture de Torah à plusieurs",
        inLanguage: "fr-FR",
        step: [
          { "@type": "HowToStep", name: "Créer une session", text: "Créez une session et nommez-la." },
          { "@type": "HowToStep", name: "Choisir le texte", text: "Choisissez le texte (Talmud, Tehilim, Michna, Tanakh) et les parties." },
          { "@type": "HowToStep", name: "Partager le lien", text: "Partagez le lien ou le QR code avec les participants." },
          { "@type": "HowToStep", name: "Réserver les passages", text: "Chaque participant réserve les passages qu'il prend en charge." },
          { "@type": "HowToStep", name: "Suivre la progression", text: "Suivez l'avancée jusqu'au siyoum." },
        ],
      },
    ],
  },
  {
    file: "etude.html",
    path: "/etude",
    title: "Étude libre : Tehilim, Michna, Talmud et Tanakh en ligne | Petite Jérusalem",
    description:
      "Lisez et étudiez gratuitement les textes juifs en ligne : Tehilim (Psaumes), Michna, Talmud et Tanakh, en hébreu et en phonétique. Réservez vos passages et suivez vos lectures.",
    sitemap: { priority: 0.8, changefreq: "weekly" },
    bodyHtml: `
  <main class="seo-article">
    <h1>Étude libre : lire les textes de la Torah en ligne</h1>
    <p class="seo-lead">
      Accédez gratuitement aux grands corpus de l'étude juive, en hébreu et en phonétique, pour les
      lire seul ou les <a href="/share-reading">partager à plusieurs</a>.
    </p>
    <section class="seo-section">
      <h2>Les textes disponibles</h2>
      <ul>
        <li><strong>Tehilim</strong> (Psaumes) : les 150 chapitres du livre de Tehilim.</li>
        <li><strong>Michna</strong> : les six ordres (sedarim) de la Michna.</li>
        <li><strong>Talmud Bavli</strong> : les traités (massekhtot) du Talmud de Babylone.</li>
        <li><strong>Tanakh</strong> : la Torah, les Neviim (Prophètes) et les Ketouvim (Écrits).</li>
      </ul>
      <p>Envie d'avancer en groupe ? Lancez un <a href="/share-reading">partage de lectures</a> ou
      organisez de quoi <a href="/finir-le-chass">finir le Chass</a> ensemble.</p>
    </section>
  </main>`,
    jsonLd: [
      breadcrumb([
        { name: "Accueil", path: "/" },
        { name: "Étude", path: "/etude" },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Textes disponibles à l'étude",
        itemListElement: ["Tehilim", "Michna", "Talmud Bavli", "Tanakh"].map((n, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: n,
        })),
      },
    ],
  },
  {
    file: "chiourim.html",
    path: "/chiourim",
    title: "Chiourim : cours et leçons de Torah à écouter | Petite Jérusalem",
    description:
      "Écoutez des chiourim : cours et leçons de Torah partagés par la communauté. Trouvez un cours par thème ou par rav et apprenez à votre rythme, gratuitement.",
    sitemap: { priority: 0.8, changefreq: "weekly" },
    bodyHtml: `
  <main class="seo-article">
    <h1>Chiourim : cours et leçons de Torah</h1>
    <p class="seo-lead">
      Écoutez des <strong>chiourim</strong>, des cours de Torah partagés par la communauté. Parcourez
      les leçons par rav ou par thème et apprenez à votre rythme.
    </p>
    <section class="seo-section">
      <p>Vous préférez étudier un texte vous-même ? Lisez les sources en
      <a href="/etude">étude libre</a> ou lancez un <a href="/share-reading">partage de lectures</a>
      avec votre communauté.</p>
    </section>
  </main>`,
    jsonLd: [
      breadcrumb([
        { name: "Accueil", path: "/" },
        { name: "Chiourim", path: "/chiourim" },
      ]),
    ],
  },
  {
    file: "login.html",
    path: "/login",
    title: "Connexion – Petite Jérusalem",
    description:
      "Connectez-vous pour créer des sessions de partage de lectures, réserver des textes et suivre vos études.",
    robots: "noindex, follow",
    sitemap: false,
    bodyHtml: `
  <main class="seo-article">
    <h1>Connexion à Petite Jérusalem</h1>
    <p>Connectez-vous pour créer des sessions de partage de lectures, réserver des textes et suivre
    vos études.</p>
  </main>`,
  },
];

// ---- Long-form landing pages (rendered by ContentPage.vue) --------------

const finirLeChassFaq = [
  {
    q: "Comment finir le Chass à plusieurs ?",
    a: "Créez une session de partage sur Petite Jérusalem, choisissez le Talmud et les traités à étudier, puis partagez le lien. Chaque participant réserve les dapim qu'il prend en charge ; le texte est terminé quand tous les passages ont été lus : c'est le siyoum haShass.",
  },
  {
    q: "Combien de personnes faut-il pour terminer le Talmud ?",
    a: "Il n'y a pas de minimum : à deux comme à plusieurs centaines. Plus il y a de participants, plus chacun a peu de passages à lire et plus le Chass se termine vite.",
  },
  {
    q: "Peut-on dédier l'étude à la mémoire d'un proche ?",
    a: "Oui. Beaucoup organisent un limoud pour un ilouï nechama (élévation de l'âme d'un défunt), une refoua chelema (guérison d'un malade) ou une hatslakha. Indiquez la dédicace dans le nom et la description de la session.",
  },
  {
    q: "Est-ce gratuit ?",
    a: "Oui, Petite Jérusalem est entièrement gratuit, et l'on peut participer même sans créer de compte.",
  },
];

const partageTehilimFaq = [
  {
    q: "Comment répartir les Tehilim entre plusieurs personnes ?",
    a: "Créez une session de type Tehilim sur Petite Jérusalem, sélectionnez les chapitres, puis partagez le lien. Chacun réserve les Tehilim qu'il lit ; le sefer complet (150 chapitres) se termine bien plus vite à plusieurs.",
  },
  {
    q: "Peut-on lire les Tehilim pour un malade ?",
    a: "Oui. Le partage de Tehilim est souvent organisé pour une refoua chelema (guérison). Vous pouvez préciser le nom de la personne et l'intention dans la description de la session.",
  },
  {
    q: "Et à la mémoire d'un défunt ?",
    a: "Le partage de Tehilim convient aussi pour un ilouï nechama, à la mémoire d'un proche, notamment pour une hiloula ou un anniversaire de décès.",
  },
  {
    q: "Faut-il un compte pour participer ?",
    a: "Non, on peut réserver et lire des Tehilim en tant qu'invité. Créer un compte gratuit permet de retrouver ses lectures et de suivre sa progression.",
  },
];

export const landingPages: SeoPage[] = [
  {
    file: "finir-le-chass.html",
    path: "/finir-le-chass",
    title: "Finir le Chass à plusieurs : se répartir le Talmud en ligne | Petite Jérusalem",
    description:
      "Organisez l'étude collective du Talmud pour finir le Chass à plusieurs : créez une session, répartissez les traités et les dapim, suivez la progression jusqu'au siyoum haShass. Gratuit et en français.",
    sitemap: { priority: 0.7, changefreq: "monthly" },
    bodyHtml: `
  <main class="seo-article">
    <h1>Finir le Chass à plusieurs</h1>
    <p class="seo-lead">
      « Finir le Chass », c'est terminer l'étude de l'ensemble du Talmud Bavli, ses 63 traités
      (massekhtot). Seul, cela demande des années ; à plusieurs, en se répartissant les passages, un
      groupe ou une communauté peut y arriver en bien moins de temps. Petite Jérusalem est l'outil
      gratuit qui organise ce partage.
    </p>

    <section class="seo-section">
      <h2>Pourquoi finir le Chass ensemble ?</h2>
      <p>L'achèvement de l'étude du Talmud (le siyoum haShass) est un grand moment. On l'organise
      souvent collectivement&nbsp;:</p>
      <ul>
        <li>pour un <strong>ilouï nechama</strong>, à la mémoire et pour l'élévation de l'âme d'un proche&nbsp;;</li>
        <li>pour une <strong>refoua chelema</strong>, la guérison d'un malade&nbsp;;</li>
        <li>pour une <strong>hatslakha</strong>, la réussite d'un projet, d'un mariage, d'une naissance&nbsp;;</li>
        <li>à l'occasion d'une <strong>hiloula</strong> ou d'un événement communautaire.</li>
      </ul>
    </section>

    <section class="seo-section">
      <h2>Comment l'organiser sur Petite Jérusalem</h2>
      <ol>
        <li>Créez une <a href="/share-reading">session de partage</a> et nommez-la (par ex. « Siyoum haShass à la mémoire de… »).</li>
        <li>Choisissez le Talmud et les traités à couvrir, puis répartissez-les en passages.</li>
        <li>Partagez le lien avec les participants : famille, amis, kehila.</li>
        <li>Chacun réserve les dapim qu'il étudie, puis les marque comme lus.</li>
        <li>Suivez l'avancée commune jusqu'au siyoum.</li>
      </ol>
      <p><a class="seo-cta" href="/share-reading/new-session">Créer une session pour finir le Chass</a></p>
    </section>

    ${faqHtml(finirLeChassFaq)}
  </main>`,
    jsonLd: [
      breadcrumb([
        { name: "Accueil", path: "/" },
        { name: "Finir le Chass", path: "/finir-le-chass" },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "Finir le Chass à plusieurs : se répartir le Talmud en ligne",
        inLanguage: "fr-FR",
        author: { "@type": "Organization", name: SITE_NAME },
        publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: OG_IMAGE } },
      },
      faqJsonLd(finirLeChassFaq),
    ],
  },
  {
    file: "partage-tehilim.html",
    path: "/partage-tehilim",
    title: "Partage de Tehilim : répartir les Psaumes à plusieurs | Petite Jérusalem",
    description:
      "Répartissez les 150 Tehilim entre plusieurs personnes pour les terminer ensemble : pour un malade (refoua chelema), à la mémoire d'un proche (ilouï nechama) ou pour une hatslakha. Gratuit, sans compte obligatoire.",
    sitemap: { priority: 0.7, changefreq: "monthly" },
    bodyHtml: `
  <main class="seo-article">
    <h1>Partage de Tehilim à plusieurs</h1>
    <p class="seo-lead">
      Lire un sefer Tehilim entier (les 150 Psaumes) prend du temps. En se répartissant les chapitres
      entre plusieurs personnes, on peut le terminer en quelques minutes. Petite Jérusalem permet
      d'organiser ce partage gratuitement et de suivre les chapitres déjà lus.
    </p>

    <section class="seo-section">
      <h2>Pour quelle intention ?</h2>
      <ul>
        <li><strong>Refoua chelema</strong> : pour la guérison d'un malade.</li>
        <li><strong>Ilouï nechama</strong> : à la mémoire et pour l'élévation de l'âme d'un défunt.</li>
        <li><strong>Hatslakha</strong> : pour la réussite d'un projet, d'un examen, d'un mariage.</li>
        <li>Pour une <strong>hiloula</strong>, un Shabbat ou un événement communautaire.</li>
      </ul>
    </section>

    <section class="seo-section">
      <h2>Comment partager les Tehilim</h2>
      <ol>
        <li>Créez une <a href="/share-reading">session</a> de type Tehilim et précisez l'intention dans la description.</li>
        <li>Sélectionnez les chapitres (ou tout le sefer).</li>
        <li>Partagez le lien : chacun réserve et lit ses chapitres, même en tant qu'invité.</li>
        <li>Suivez en temps réel les Tehilim déjà lus jusqu'à terminer le sefer.</li>
      </ol>
      <p><a class="seo-cta" href="/share-reading/new-session">Créer un partage de Tehilim</a></p>
    </section>

    ${faqHtml(partageTehilimFaq)}
  </main>`,
    jsonLd: [
      breadcrumb([
        { name: "Accueil", path: "/" },
        { name: "Partage de Tehilim", path: "/partage-tehilim" },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "Partage de Tehilim : répartir les Psaumes à plusieurs",
        inLanguage: "fr-FR",
        author: { "@type": "Organization", name: SITE_NAME },
        publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: OG_IMAGE } },
      },
      faqJsonLd(partageTehilimFaq),
    ],
  },
];

/** All pages that the prerender script turns into static HTML files. */
export const allPages: SeoPage[] = [...appPages, ...landingPages];

// ---- Pure HTML transforms (shared by prerender + tests) -----------------

function replaceTitle(html: string, title: string): string {
  return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(title)}</title>`);
}

function replaceMetaContent(
  html: string,
  attr: "name" | "property",
  value: string,
  content: string,
): string {
  const re = new RegExp(
    `(<meta\\b[^>]*\\b${attr}="${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*\\bcontent=")[\\s\\S]*?(")`,
  );
  return html.replace(re, (_m, p1, p2) => `${p1}${escapeAttr(content)}${p2}`);
}

function replaceCanonical(html: string, href: string): string {
  return html.replace(
    /(<link\b[^>]*rel="canonical"[^>]*href=")[^"]*(")/,
    (_m, p1, p2) => `${p1}${escapeAttr(href)}${p2}`,
  );
}

/**
 * Inject page-specific `<head>` metadata (title, description, OG/Twitter,
 * canonical, robots) into the built `index.html` template. Pure; unit-tested.
 */
export function injectMeta(template: string, page: SeoPage): string {
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

/** Inject crawlable body content + extra JSON-LD into the shell. Pure. */
export function injectBody(template: string, page: SeoPage): string {
  let html = template;

  const body = `${page.bodyHtml}\n${staticFooterHtml}`;
  // The built shell ships an empty `<div id="app"></div>`; fill it so non-JS
  // crawlers see the content. Vue clears and re-renders #app on mount.
  html = html.replace(/(<div id="app">)(<\/div>)/, (_m, open, close) => `${open}${body}${close}`);

  if (page.jsonLd?.length) {
    const blocks = page.jsonLd
      .map((obj) => `<script type="application/ld+json">\n${JSON.stringify(obj)}\n</script>`)
      .join("\n    ");
    html = html.replace("</head>", `    ${blocks}\n  </head>`);
  }

  return html;
}

/** Full transform: built shell + page → final static HTML. Pure. */
export function renderPage(template: string, page: SeoPage): string {
  return injectBody(injectMeta(template, page), page);
}

/** Build sitemap.xml from the indexable pages. `lastmod` is an ISO date string. */
export function buildSitemap(lastmod: string): string {
  const urls = allPages
    .filter((p) => p.sitemap !== false)
    .map((p) => {
      const s = p.sitemap || { priority: 0.5, changefreq: "weekly" };
      return [
        "  <url>",
        `    <loc>${SITE_URL}${p.path === "/" ? "/" : p.path}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${s.changefreq}</changefreq>`,
        `    <priority>${s.priority.toFixed(1)}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
