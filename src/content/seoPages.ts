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
const faqHtml = (faq: { q: string; a: string }[], heading: string): string => `
  <section class="seo-section" aria-labelledby="faq-title">
    <h2 id="faq-title">${heading}</h2>
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
      <a href="/tehilim">Tehilim par intention</a>
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
        <li><strong>Tehilim</strong> (Psaumes) : les <a href="/etude/tehilim/1">150 chapitres</a> du livre de Tehilim, en hébreu et en phonétique.</li>
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

export type Locale = "fr" | "en" | "he";

export type LandingLocaleContent = {
  title: string;
  description: string;
  bodyHtml: string;
  jsonLd?: Record<string, unknown>[];
};

export type LandingPage = {
  file: string;
  path: string;
  sitemap?: { priority: number; changefreq: string } | false;
  /** Same content in every supported language, picked at runtime by ContentPage. */
  locales: Record<Locale, LandingLocaleContent>;
};

/** Localized strings for one landing page; the HTML structure is shared across languages. */
type LandingStrings = {
  lang: string; // BCP-47 tag for JSON-LD inLanguage
  title: string;
  description: string;
  h1: string;
  lead: string;
  whyTitle: string;
  whyIntro?: string;
  why: string[];
  howTitle: string;
  how: string[];
  cta: string;
  faqHeading: string;
  faq: { q: string; a: string }[];
  breadcrumbHome: string;
  breadcrumbName: string;
  articleHeadline: string;
};

/** Build one locale's content from its strings; the markup is identical across languages. */
function buildLanding(path: string, s: LandingStrings): LandingLocaleContent {
  const bodyHtml = `
  <main class="seo-article">
    <h1>${s.h1}</h1>
    <p class="seo-lead">${s.lead}</p>

    <section class="seo-section">
      <h2>${s.whyTitle}</h2>
      ${s.whyIntro ? `<p>${s.whyIntro}</p>` : ""}
      <ul>
        ${s.why.map((li) => `<li>${li}</li>`).join("\n        ")}
      </ul>
    </section>

    <section class="seo-section">
      <h2>${s.howTitle}</h2>
      <ol>
        ${s.how.map((li) => `<li>${li}</li>`).join("\n        ")}
      </ol>
      <p><a class="seo-cta" href="/share-reading/new-session">${s.cta}</a></p>
    </section>

    ${faqHtml(s.faq, s.faqHeading)}
  </main>`;

  return {
    title: s.title,
    description: s.description,
    bodyHtml,
    jsonLd: [
      breadcrumb([
        { name: s.breadcrumbHome, path: "/" },
        { name: s.breadcrumbName, path },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: s.articleHeadline,
        inLanguage: s.lang,
        author: { "@type": "Organization", name: SITE_NAME },
        publisher: {
          "@type": "Organization",
          name: SITE_NAME,
          logo: { "@type": "ImageObject", url: OG_IMAGE },
        },
      },
      faqJsonLd(s.faq),
    ],
  };
}

// ---- finir-le-chass: localized strings ----

const FINIR_FR: LandingStrings = {
  lang: "fr-FR",
  title: "Finir le Chass à plusieurs : se répartir le Talmud en ligne | Petite Jérusalem",
  description:
    "Organisez l'étude collective du Talmud pour finir le Chass à plusieurs : créez une session, répartissez les traités et les dapim, suivez la progression jusqu'au siyoum haShass. Gratuit et en français.",
  h1: "Finir le Chass à plusieurs",
  lead: "« Finir le Chass », c'est terminer l'étude de l'ensemble du Talmud Bavli, ses 63 traités (massekhtot). Seul, cela demande des années ; à plusieurs, en se répartissant les passages, un groupe ou une communauté peut y arriver en bien moins de temps. Petite Jérusalem est l'outil gratuit qui organise ce partage.",
  whyTitle: "Pourquoi finir le Chass ensemble ?",
  whyIntro:
    "L'achèvement de l'étude du Talmud (le siyoum haShass) est un grand moment. On l'organise souvent collectivement&nbsp;:",
  why: [
    "pour un <strong>ilouï nechama</strong>, à la mémoire et pour l'élévation de l'âme d'un proche&nbsp;;",
    "pour une <strong>refoua chelema</strong>, la guérison d'un malade&nbsp;;",
    "pour une <strong>hatslakha</strong>, la réussite d'un projet, d'un mariage, d'une naissance&nbsp;;",
    "à l'occasion d'une <strong>hiloula</strong> ou d'un événement communautaire.",
  ],
  howTitle: "Comment l'organiser sur Petite Jérusalem",
  how: [
    "Créez une <a href=\"/share-reading\">session de partage</a> et nommez-la (par ex. « Siyoum haShass à la mémoire de… »).",
    "Choisissez le Talmud et les traités à couvrir, puis répartissez-les en passages.",
    "Partagez le lien avec les participants : famille, amis, kehila.",
    "Chacun réserve les dapim qu'il étudie, puis les marque comme lus.",
    "Suivez l'avancée commune jusqu'au siyoum.",
  ],
  cta: "Créer une session pour finir le Chass",
  faqHeading: "Questions fréquentes",
  faq: finirLeChassFaq,
  breadcrumbHome: "Accueil",
  breadcrumbName: "Finir le Chass",
  articleHeadline: "Finir le Chass à plusieurs : se répartir le Talmud en ligne",
};

const FINIR_EN: LandingStrings = {
  lang: "en",
  title: "Finish the Shas together: split the Talmud online | Petite Jérusalem",
  description:
    "Organize collective Talmud study to finish the Shas together: create a session, split the tractates and dapim, and follow the progress to the siyum haShas. Free and online.",
  h1: "Finish the Shas together",
  lead: "'Finishing the Shas' means completing the study of the entire Babylonian Talmud, its 63 tractates (masechtot). Alone it takes years; together, by splitting the passages, a group or community can do it in far less time. Petite Jérusalem is the free tool that organizes this sharing.",
  whyTitle: "Why finish the Shas together?",
  whyIntro:
    "Completing the Talmud (the siyum haShas) is a major milestone. It is often organized collectively:",
  why: [
    "for an <strong>ilui neshama</strong>, in memory and for the elevation of a loved one's soul;",
    "for a <strong>refua shlema</strong>, the recovery of someone who is ill;",
    "for <strong>hatzlacha</strong>, success in a project, a wedding or a birth;",
    "for a <strong>hilula</strong> or a community event.",
  ],
  howTitle: "How to organize it on Petite Jérusalem",
  how: [
    "Create a <a href=\"/share-reading\">sharing session</a> and name it (e.g. 'Siyum haShas in memory of…').",
    "Choose the Talmud and the tractates to cover, then split them into passages.",
    "Share the link with the participants: family, friends, community.",
    "Everyone reserves the dapim they study, then marks them as read.",
    "Follow the shared progress to the siyum.",
  ],
  cta: "Create a session to finish the Shas",
  faqHeading: "Frequently asked questions",
  faq: [
    {
      q: "How do you finish the Shas with several people?",
      a: "Create a sharing session on Petite Jérusalem, choose the Talmud and the tractates to study, then share the link. Each participant reserves the dapim they take on; the text is finished once every passage has been learned, which is the siyum haShas.",
    },
    {
      q: "How many people are needed to finish the Talmud?",
      a: "There is no minimum: from two people to several hundred. The more participants, the fewer passages each one has, and the faster the Shas is completed.",
    },
    {
      q: "Can the study be dedicated in someone's memory?",
      a: "Yes. Many organize a study for an ilui neshama (elevation of a departed soul), a refua shlema (recovery of someone ill) or hatzlacha. State the dedication in the session's name and description.",
    },
    {
      q: "Is it free?",
      a: "Yes, Petite Jérusalem is completely free, and you can take part even without creating an account.",
    },
  ],
  breadcrumbHome: "Home",
  breadcrumbName: "Finish the Shas",
  articleHeadline: "Finish the Shas together: split the Talmud online",
};

const FINIR_HE: LandingStrings = {
  lang: "he",
  title: "לסיים את הש״ס יחד: חלוקת התלמוד אונליין | Petite Jérusalem",
  description:
    "ארגנו לימוד משותף של התלמוד כדי לסיים את הש״ס יחד: צרו סשן, חלקו את המסכתות והדפים, ועקבו אחר ההתקדמות עד סיום הש״ס. בחינם ואונליין.",
  h1: "לסיים את הש״ס יחד",
  lead: "'לסיים את הש״ס' פירושו להשלים את לימוד כל התלמוד הבבלי, 63 המסכתות שלו. לבד זה אורך שנים; יחד, בחלוקת הקטעים, קבוצה או קהילה יכולה לעשות זאת בזמן קצר בהרבה. Petite Jérusalem הוא הכלי החינמי שמארגן את השיתוף הזה.",
  whyTitle: "למה לסיים את הש״ס יחד?",
  whyIntro: "סיום לימוד התלמוד (סיום הש״ס) הוא רגע גדול. לרוב מארגנים אותו במשותף:",
  why: [
    "ל<strong>עילוי נשמה</strong>, לזכר ולעילוי נשמתו של אדם יקר;",
    "ל<strong>רפואה שלמה</strong> של חולה;",
    "ל<strong>הצלחה</strong> בפרויקט, בחתונה או בלידה;",
    "לרגל <strong>הילולה</strong> או אירוע קהילתי.",
  ],
  howTitle: "איך מארגנים ב-Petite Jérusalem",
  how: [
    "צרו <a href=\"/share-reading\">סשן שיתוף</a> ותנו לו שם (למשל «סיום הש״ס לעילוי נשמת…»).",
    "בחרו את התלמוד ואת המסכתות לכיסוי, וחלקו אותן לקטעים.",
    "שתפו את הקישור עם המשתתפים: משפחה, חברים, קהילה.",
    "כל אחד מזמין את הדפים שהוא לומד, ומסמן אותם כנקראו.",
    "עקבו אחר ההתקדמות המשותפת עד הסיום.",
  ],
  cta: "צרו סשן לסיום הש״ס",
  faqHeading: "שאלות נפוצות",
  faq: [
    {
      q: "איך מסיימים את הש״ס בכמה אנשים?",
      a: "צרו סשן שיתוף ב-Petite Jérusalem, בחרו את התלמוד ואת המסכתות ללימוד, ושתפו את הקישור. כל משתתף מזמין את הדפים שעליהם הוא אחראי; הטקסט מסתיים כשכל הקטעים נלמדו, וזהו סיום הש״ס.",
    },
    {
      q: "כמה אנשים צריך כדי לסיים את התלמוד?",
      a: "אין מינימום: משניים ועד מאות. ככל שיש יותר משתתפים, לכל אחד יש פחות קטעים, והש״ס מסתיים מהר יותר.",
    },
    {
      q: "אפשר להקדיש את הלימוד לזכר אדם יקר?",
      a: "כן. רבים מארגנים לימוד לעילוי נשמה, לרפואה שלמה של חולה או להצלחה. ציינו את ההקדשה בשם הסשן ובתיאורו.",
    },
    {
      q: "האם זה בחינם?",
      a: "כן, Petite Jérusalem חינמי לחלוטין, ואפשר להשתתף גם בלי ליצור חשבון.",
    },
  ],
  breadcrumbHome: "בית",
  breadcrumbName: "לסיים את הש״ס",
  articleHeadline: "לסיים את הש״ס יחד: חלוקת התלמוד אונליין",
};

// ---- partage-tehilim: localized strings ----

const TEHILIM_FR: LandingStrings = {
  lang: "fr-FR",
  title: "Partage de Tehilim : répartir les Psaumes à plusieurs | Petite Jérusalem",
  description:
    "Répartissez les 150 Tehilim entre plusieurs personnes pour les terminer ensemble : pour un malade (refoua chelema), à la mémoire d'un proche (ilouï nechama) ou pour une hatslakha. Gratuit, sans compte obligatoire.",
  h1: "Partage de Tehilim à plusieurs",
  lead: "Lire un sefer Tehilim entier (les 150 Psaumes) prend du temps. En se répartissant les chapitres entre plusieurs personnes, on peut le terminer en quelques minutes. Petite Jérusalem permet d'organiser ce partage gratuitement et de suivre les chapitres déjà lus.",
  whyTitle: "Pour quelle intention ?",
  why: [
    "<strong>Refoua chelema</strong> : pour la guérison d'un malade.",
    "<strong>Ilouï nechama</strong> : à la mémoire et pour l'élévation de l'âme d'un défunt.",
    "<strong>Hatslakha</strong> : pour la réussite d'un projet, d'un examen, d'un mariage.",
    "Pour une <strong>hiloula</strong>, un Shabbat ou un événement communautaire.",
  ],
  howTitle: "Comment partager les Tehilim",
  how: [
    "Créez une <a href=\"/share-reading\">session</a> de type Tehilim et précisez l'intention dans la description.",
    "Sélectionnez les chapitres (ou tout le sefer).",
    "Partagez le lien : chacun réserve et lit ses chapitres, même en tant qu'invité.",
    "Suivez en temps réel les Tehilim déjà lus jusqu'à terminer le sefer.",
  ],
  cta: "Créer un partage de Tehilim",
  faqHeading: "Questions fréquentes",
  faq: partageTehilimFaq,
  breadcrumbHome: "Accueil",
  breadcrumbName: "Partage de Tehilim",
  articleHeadline: "Partage de Tehilim : répartir les Psaumes à plusieurs",
};

const TEHILIM_EN: LandingStrings = {
  lang: "en",
  title: "Share Tehilim: split the Psalms among several people | Petite Jérusalem",
  description:
    "Split the 150 Tehilim among several people to finish them together: for someone ill (refua shlema), in memory of a loved one (ilui neshama) or for hatzlacha. Free, no account required.",
  h1: "Share Tehilim with several people",
  lead: "Reading a whole sefer Tehilim (the 150 Psalms) takes time. By splitting the chapters among several people, it can be finished in a few minutes. Petite Jérusalem lets you organize this sharing for free and track the chapters already read.",
  whyTitle: "For which intention?",
  why: [
    "<strong>Refua shlema</strong>: for the recovery of someone who is ill.",
    "<strong>Ilui neshama</strong>: in memory and for the elevation of a departed soul.",
    "<strong>Hatzlacha</strong>: for success in a project, an exam or a wedding.",
    "For a <strong>hilula</strong>, a Shabbat or a community event.",
  ],
  howTitle: "How to share the Tehilim",
  how: [
    "Create a <a href=\"/share-reading\">session</a> of type Tehilim and state the intention in the description.",
    "Select the chapters (or the whole sefer).",
    "Share the link: everyone reserves and reads their chapters, even as a guest.",
    "Track in real time the Tehilim already read until the sefer is finished.",
  ],
  cta: "Create a Tehilim sharing",
  faqHeading: "Frequently asked questions",
  faq: [
    {
      q: "How do you split the Tehilim among several people?",
      a: "Create a Tehilim session on Petite Jérusalem, select the chapters, then share the link. Everyone reserves the Tehilim they read; the full sefer (150 chapters) is finished far faster together.",
    },
    {
      q: "Can you read Tehilim for someone who is ill?",
      a: "Yes. Sharing Tehilim is often organized for a refua shlema (recovery). You can state the person's name and the intention in the session description.",
    },
    {
      q: "And in memory of someone who has passed away?",
      a: "Sharing Tehilim is also fitting for an ilui neshama, in memory of a loved one, in particular for a hilula or a yahrzeit.",
    },
    {
      q: "Do you need an account to take part?",
      a: "No, you can reserve and read Tehilim as a guest. A free account lets you find your readings again and track your progress.",
    },
  ],
  breadcrumbHome: "Home",
  breadcrumbName: "Share Tehilim",
  articleHeadline: "Share Tehilim: split the Psalms among several people",
};

const TEHILIM_HE: LandingStrings = {
  lang: "he",
  title: "חלוקת תהילים: חלוקת הפרקים בין כמה אנשים | Petite Jérusalem",
  description:
    "חלקו את 150 פרקי התהילים בין כמה אנשים כדי לסיים אותם יחד: לרפואה שלמה של חולה, לעילוי נשמת אדם יקר או להצלחה. בחינם, ללא צורך בחשבון.",
  h1: "חלוקת תהילים בין כמה אנשים",
  lead: "קריאת ספר תהילים שלם (150 הפרקים) אורכת זמן. בחלוקת הפרקים בין כמה אנשים אפשר לסיים אותו בכמה דקות. Petite Jérusalem מאפשר לארגן את החלוקה הזו בחינם ולעקוב אחר הפרקים שכבר נקראו.",
  whyTitle: "לאיזו כוונה?",
  why: [
    "<strong>רפואה שלמה</strong>: לרפואתו של חולה.",
    "<strong>עילוי נשמה</strong>: לזכר ולעילוי נשמתו של נפטר.",
    "<strong>הצלחה</strong>: להצלחה בפרויקט, במבחן או בחתונה.",
    "לרגל <strong>הילולה</strong>, שבת או אירוע קהילתי.",
  ],
  howTitle: "איך לחלק את התהילים",
  how: [
    "צרו <a href=\"/share-reading\">סשן</a> מסוג תהילים וציינו את הכוונה בתיאור.",
    "בחרו את הפרקים (או את כל הספר).",
    "שתפו את הקישור: כל אחד מזמין וקורא את הפרקים שלו, גם כאורח.",
    "עקבו בזמן אמת אחר התהילים שכבר נקראו עד לסיום הספר.",
  ],
  cta: "צרו חלוקת תהילים",
  faqHeading: "שאלות נפוצות",
  faq: [
    {
      q: "איך מחלקים את התהילים בין כמה אנשים?",
      a: "צרו סשן מסוג תהילים ב-Petite Jérusalem, בחרו את הפרקים, ושתפו את הקישור. כל אחד מזמין את התהילים שהוא קורא; הספר השלם (150 פרקים) מסתיים הרבה יותר מהר יחד.",
    },
    {
      q: "אפשר לקרוא תהילים לרפואת חולה?",
      a: "כן. חלוקת תהילים מאורגנת לעיתים קרובות לרפואה שלמה. אפשר לציין את שם האדם ואת הכוונה בתיאור הסשן.",
    },
    {
      q: "ולעילוי נשמת נפטר?",
      a: "חלוקת תהילים מתאימה גם לעילוי נשמה, לזכר אדם יקר, במיוחד לרגל הילולה או יום השנה לפטירה.",
    },
    {
      q: "צריך חשבון כדי להשתתף?",
      a: "לא, אפשר להזמין ולקרוא תהילים כאורח. חשבון חינמי מאפשר למצוא שוב את הקריאות שלך ולעקוב אחר ההתקדמות.",
    },
  ],
  breadcrumbHome: "בית",
  breadcrumbName: "חלוקת תהילים",
  articleHeadline: "חלוקת תהילים: חלוקת הפרקים בין כמה אנשים",
};

export const landingPages: LandingPage[] = [
  {
    file: "finir-le-chass.html",
    path: "/finir-le-chass",
    sitemap: { priority: 0.7, changefreq: "monthly" },
    locales: {
      fr: buildLanding("/finir-le-chass", FINIR_FR),
      en: buildLanding("/finir-le-chass", FINIR_EN),
      he: buildLanding("/finir-le-chass", FINIR_HE),
    },
  },
  {
    file: "partage-tehilim.html",
    path: "/partage-tehilim",
    sitemap: { priority: 0.7, changefreq: "monthly" },
    locales: {
      fr: buildLanding("/partage-tehilim", TEHILIM_FR),
      en: buildLanding("/partage-tehilim", TEHILIM_EN),
      he: buildLanding("/partage-tehilim", TEHILIM_HE),
    },
  },
];

const DEFAULT_LANDING_LOCALE: Locale = "fr";

/** Landing pages flattened to the default locale, for the static prerender + sitemap. */
const landingAsSeoPages: SeoPage[] = landingPages.map((p) => ({
  file: p.file,
  path: p.path,
  sitemap: p.sitemap,
  ...p.locales[DEFAULT_LANDING_LOCALE],
}));

// ---- Tehilim par intention (hub + intention pages) ----------------------
//
// Evergreen utility pages answering "which Tehilim to read for …" queries
// (a malade / refoua chelema, mariage, parnassa…). Each page lists the
// traditionally-read psalms (linked to the full reader) and converts to a
// shared reading. French-only for now (the brief defers i18n). The psalm
// lists are provisional and to be revalidated by a competent person, so each
// page carries a prudent disclaimer.

const TEHILIM_HUB_PATH = "/tehilim";
const SHARE_NEW_SESSION = "/share-reading/new-session";

/** The Tehilim reader serves chapter N at textId 102 + N (see textStudies.json). */
const tehilimReaderHref = (n: number): string => `/lire/${102 + n}`;

const intentionPath = (slug: string): string => `${TEHILIM_HUB_PATH}/${slug}`;

type Intention = {
  /** URL slug, lowercase and without accents (e.g. "refoua-chelema"). */
  slug: string;
  title: string;
  description: string;
  h1: string;
  /** Intro paragraph(s), inline HTML. */
  lead: string;
  /** Recommended psalm numbers, in reading order. */
  psalms: number[];
  /** Optional extra note shown under the psalm list (inline HTML). */
  psalmsNote?: string;
  /** Short label + blurb used on the hub card and breadcrumb. */
  cardTitle: string;
  cardDesc: string;
  /** Font Awesome 6 solid icon name (e.g. "fa-heart-pulse") for the hub card. */
  icon: string;
  /** Slugs of related intentions for internal linking (unknown slugs are ignored). */
  related: string[];
  faq: { q: string; a: string }[];
};

/** Prudent disclaimer shown on every intention page (lists pending revalidation). */
const TEHILIM_DISCLAIMER =
  "Ces listes sont indicatives, selon les sources couramment citées, et en cours de revalidation. En cas de doute, demandez conseil à votre rav.";

const INTENTIONS: Intention[] = [
  {
    slug: "refoua-chelema",
    title: "Tehilim pour un malade (refoua chelema) | Petite Jérusalem",
    description:
      "Quels Tehilim lire pour la refoua chelema (guérison d'un malade) : psaumes 20, 121, 6, 30 et 38, à lire seul ou à plusieurs pour aller plus vite.",
    h1: "Tehilim pour la guérison d'un malade (refoua chelema)",
    lead: "La <strong>refoua chelema</strong> est la prière pour la guérison complète d'un malade. On a coutume de lire certains Tehilim (Psaumes) en pensant à la personne souffrante. Lus à plusieurs, en se répartissant les chapitres, ils se terminent bien plus vite.",
    psalms: [20, 121, 6, 30, 38],
    psalmsNote:
      "L'usage est de prier pour la personne avec son prénom hébraïque suivi de celui de sa mère (par ex. «&nbsp;Untel ben Unetelle&nbsp;»). Beaucoup ajoutent le psaume 119 selon les lettres du prénom du malade.",
    cardTitle: "Refoua chelema (guérison d'un malade)",
    cardDesc: "Les psaumes à lire pour la guérison d'une personne malade.",
    icon: "fa-heart-pulse",
    related: ["accouchement", "protection"],
    faq: [
      {
        q: "Quels Tehilim lire pour un malade ?",
        a: "On lit traditionnellement les psaumes 20, 121, 6, 30 et 38 pour une refoua chelema. Beaucoup ajoutent le psaume 119 selon les lettres du prénom du malade. En cas de doute, demandez conseil à votre rav.",
      },
      {
        q: "Comment lire les Tehilim pour la guérison à plusieurs ?",
        a: "Créez une session de partage de Tehilim sur Petite Jérusalem, indiquez le nom du malade, puis partagez le lien. Chacun lit quelques psaumes et l'on termine bien plus vite, ensemble.",
      },
      {
        q: "Faut-il mentionner le nom du malade ?",
        a: "L'usage est de prier pour la personne en utilisant son prénom hébraïque suivi de celui de sa mère (par ex. « Untel ben Unetelle »). Vous pouvez l'indiquer dans la description de la session de partage.",
      },
      {
        q: "Est-ce gratuit ?",
        a: "Oui, Petite Jérusalem est entièrement gratuit, et l'on peut participer même sans créer de compte.",
      },
    ],
  },
  {
    slug: "mariage",
    title: "Tehilim pour le mariage (zivoug) | Petite Jérusalem",
    description:
      "Quels Tehilim lire pour trouver son conjoint (zivoug) : psaumes 32, 38, 70, 71, 121, 124 et 133, à lire seul ou à plusieurs pour aller plus vite.",
    h1: "Tehilim pour trouver son conjoint (zivoug)",
    lead: "Le <strong>zivoug</strong> désigne l'âme sœur, le conjoint que l'on cherche à rencontrer. On a coutume de lire certains Tehilim (Psaumes) en priant pour trouver son conjoint et fonder un foyer. Lus à plusieurs, ils se terminent plus vite.",
    psalms: [32, 38, 70, 71, 121, 124, 133],
    psalmsNote: "Certains lisent aussi les psaumes 23 et 25, notamment avant et le jour du mariage.",
    cardTitle: "Mariage (zivoug)",
    cardDesc: "Les psaumes à lire pour trouver son conjoint et fonder un foyer.",
    icon: "fa-ring",
    related: ["reussite", "parnassa"],
    faq: [
      {
        q: "Quels Tehilim lire pour trouver son conjoint ?",
        a: "On lit traditionnellement les psaumes 32, 38, 70, 71, 121, 124 et 133 pour le zivoug. Certains ajoutent les psaumes 23 et 25. En cas de doute, demandez conseil à votre rav.",
      },
      {
        q: "Peut-on lire ces Tehilim à plusieurs ?",
        a: "Oui. Créez une session de partage de Tehilim, indiquez l'intention (et le prénom concerné), puis partagez le lien : chacun lit quelques psaumes et l'on termine bien plus vite, ensemble.",
      },
      {
        q: "Quand les lire ?",
        a: "Il n'y a pas de moment imposé ; beaucoup les lisent régulièrement. Les psaumes 23 et 25 sont en particulier lus avant et le jour du mariage.",
      },
    ],
  },
  {
    slug: "parnassa",
    title: "Tehilim pour la parnassa (subsistance) | Petite Jérusalem",
    description:
      "Quels Tehilim lire pour la parnassa (subsistance, réussite financière) : psaumes 23, 24 et 32, et la cure de 40 jours (20, 21, 23, 24, 29, 91).",
    h1: "Tehilim pour la parnassa (subsistance)",
    lead: "La <strong>parnassa</strong> est la subsistance, ce qui permet de subvenir à ses besoins. On a coutume de lire certains Tehilim (Psaumes) en priant pour une parnassa sereine et une réussite dans son travail.",
    psalms: [23, 24, 32],
    psalmsNote:
      "Il existe aussi une coutume de « cure » sur 40 jours&nbsp;: lire chaque jour les psaumes 20, 21, 23, 24, 29 et 91.",
    cardTitle: "Parnassa (subsistance)",
    cardDesc: "Les psaumes à lire pour la subsistance et la réussite financière.",
    icon: "fa-coins",
    related: ["reussite", "protection"],
    faq: [
      {
        q: "Quels Tehilim lire pour la parnassa ?",
        a: "On cite souvent les psaumes 23, 24 et 32 pour la parnassa. Une coutume consiste aussi à lire pendant 40 jours les psaumes 20, 21, 23, 24, 29 et 91. En cas de doute, demandez conseil à votre rav.",
      },
      {
        q: "Comment les lire à plusieurs ?",
        a: "Créez une session de partage de Tehilim, précisez l'intention, partagez le lien : chacun lit ses psaumes et l'on avance ensemble.",
      },
      {
        q: "Qu'est-ce que la cure de 40 jours ?",
        a: "C'est l'usage de lire chaque jour, pendant 40 jours consécutifs, un ensemble de psaumes (ici 20, 21, 23, 24, 29 et 91) avec une intention particulière.",
      },
    ],
  },
  {
    slug: "protection",
    title: "Tehilim pour la protection | Petite Jérusalem",
    description:
      "Quels Tehilim lire pour la protection (danger, voyage, mauvais œil) : psaumes 91, 121, 20, 120, 3 et 34, à lire seul ou à plusieurs.",
    h1: "Tehilim pour la protection (danger, voyage, mauvais œil)",
    lead: "On a coutume de lire certains Tehilim (Psaumes) pour demander la <strong>protection</strong> de D.ieu&nbsp;: avant un voyage, en cas de danger, ou contre le mauvais œil (ayin hara).",
    psalms: [91, 121, 20, 120, 3, 34],
    psalmsNote:
      "Contre le mauvais œil (ayin hara), on cite en particulier le psaume 31. Pour un voyage, on récite aussi la Tefilat haderekh (prière du voyageur).",
    cardTitle: "Protection (danger, voyage)",
    cardDesc: "Les psaumes à lire pour la protection, le voyage et contre le mauvais œil.",
    icon: "fa-shield-halved",
    related: ["refoua-chelema", "accouchement"],
    faq: [
      {
        q: "Quels Tehilim lire pour être protégé ?",
        a: "On cite souvent les psaumes 91, 121, 20, 120, 3 et 34 pour la protection. Contre le mauvais œil, on ajoute le psaume 31. En cas de doute, demandez conseil à votre rav.",
      },
      {
        q: "Quel psaume lire avant un voyage ?",
        a: "Le psaume 121 est très lu avant un voyage, en plus de la Tefilat haderekh (prière du voyageur).",
      },
      {
        q: "Peut-on les lire à plusieurs ?",
        a: "Oui. Créez une session de partage de Tehilim, indiquez l'intention et partagez le lien pour lire ensemble.",
      },
    ],
  },
  {
    slug: "iloui-nechama",
    title: "Tehilim pour un défunt (ilouï nechama) | Petite Jérusalem",
    description:
      "Quels Tehilim lire pour l'ilouï nechama (à la mémoire d'un défunt) : psaumes 33, 16, 17, 72, 91, 104 et 130, plus le psaume 119 selon le prénom.",
    h1: "Tehilim à la mémoire d'un défunt (ilouï nechama)",
    lead: "L'<strong>ilouï nechama</strong> est l'élévation de l'âme d'un défunt. On a coutume de lire des Tehilim (Psaumes) à la mémoire d'un proche, en particulier pour une hiloula (anniversaire de décès). Lus à plusieurs, ils se terminent plus vite.",
    psalms: [33, 16, 17, 72, 91, 104, 130],
    psalmsNote:
      "On lit aussi le psaume 119 (le plus long) en choisissant les sections (huit versets par lettre) qui forment les lettres du prénom du défunt, puis celles du mot נשמה (Nechama).",
    cardTitle: "Ilouï nechama (mémoire d'un défunt)",
    cardDesc: "Les psaumes à lire pour l'élévation de l'âme d'un proche disparu.",
    icon: "fa-dove",
    related: ["refoua-chelema", "protection"],
    faq: [
      {
        q: "Quels Tehilim lire pour un défunt ?",
        a: "On lit traditionnellement les psaumes 33, 16, 17, 72, 91, 104 et 130 pour un ilouï nechama, ainsi que les sections du psaume 119 correspondant aux lettres du prénom du défunt et au mot נשמה. En cas de doute, demandez conseil à votre rav.",
      },
      {
        q: "Qu'est-ce que le psaume 119 selon le prénom ?",
        a: "Le psaume 119 est divisé en sections de huit versets, une par lettre de l'alphabet hébraïque. On lit les sections correspondant aux lettres du prénom du défunt, puis celles du mot נשמה (Nechama).",
      },
      {
        q: "Comment organiser une lecture à plusieurs ?",
        a: "Créez une session de partage de Tehilim à la mémoire du défunt et partagez le lien à la famille et aux proches : chacun lit quelques psaumes, souvent avant la hiloula.",
      },
    ],
  },
  {
    slug: "accouchement",
    title: "Tehilim pour l'accouchement et la grossesse | Petite Jérusalem",
    description:
      "Quels Tehilim lire pour la grossesse et l'accouchement : surtout le psaume 20, ainsi que 22, 91 et 1, à lire seul ou à plusieurs.",
    h1: "Tehilim pour la grossesse et l'accouchement",
    lead: "On a coutume de lire des Tehilim (Psaumes) pour une grossesse sereine et un accouchement facile, pour la mère comme pour l'enfant à naître.",
    psalms: [20, 22, 91, 1],
    psalmsNote:
      "Le psaume 20 est le plus cité. Une liste élargie attribuée au Rav 'Haïm Kanievsky comprend les psaumes 1 à 4, 21 à 24, 33 à 47, 72 à 86 et 90.",
    cardTitle: "Grossesse & accouchement",
    cardDesc: "Les psaumes à lire pour une grossesse et un accouchement sereins.",
    icon: "fa-baby",
    related: ["refoua-chelema", "protection"],
    faq: [
      {
        q: "Quel Tehilim lire pour un accouchement ?",
        a: "Le psaume 20 est le plus cité pour l'accouchement ; on lit aussi les psaumes 22, 91 et 1. En cas de doute, demandez conseil à votre rav.",
      },
      {
        q: "Y a-t-il une liste plus longue ?",
        a: "Oui, une liste élargie attribuée au Rav 'Haïm Kanievsky comprend les psaumes 1 à 4, 21 à 24, 33 à 47, 72 à 86 et 90.",
      },
      {
        q: "Peut-on les lire à plusieurs ?",
        a: "Oui. La famille et les amis peuvent se répartir les psaumes via une session de partage, pour les terminer ensemble avant l'accouchement.",
      },
    ],
  },
  {
    slug: "reussite",
    title: "Tehilim pour la réussite (hatslakha) | Petite Jérusalem",
    description:
      "Quels Tehilim lire pour la réussite (hatslakha) — examen, projet, entreprise : psaumes 4, 20, 32 et 90, à lire seul ou à plusieurs.",
    h1: "Tehilim pour la réussite (hatslakha)",
    lead: "La <strong>hatslakha</strong> est la réussite, la bénédiction dans ce que l'on entreprend&nbsp;: un examen, un projet, une nouvelle entreprise. On a coutume de lire des Tehilim (Psaumes) pour la demander.",
    psalms: [4, 20, 32, 90],
    psalmsNote:
      "Cette liste est provisoire et recoupe en partie celle de la <a href=\"/tehilim/parnassa\">parnassa</a> ; elle sera reconfirmée.",
    cardTitle: "Réussite (hatslakha)",
    cardDesc: "Les psaumes à lire pour la réussite d'un examen, d'un projet ou d'une entreprise.",
    icon: "fa-trophy",
    related: ["parnassa", "mariage"],
    faq: [
      {
        q: "Quels Tehilim lire pour réussir un examen ou un projet ?",
        a: "On cite les psaumes 4, 20, 32 et 90 pour la hatslakha (réussite). Cette liste est provisoire et sera reconfirmée. En cas de doute, demandez conseil à votre rav.",
      },
      {
        q: "Quelle différence avec la parnassa ?",
        a: "La parnassa concerne spécifiquement la subsistance et la réussite financière ; la hatslakha vise la réussite en général. Les listes se recoupent en partie.",
      },
      {
        q: "Peut-on les lire à plusieurs ?",
        a: "Oui. Créez une session de partage de Tehilim, précisez l'intention et partagez le lien pour lire ensemble.",
      },
    ],
  },
];

const intentionBySlug = new Map(INTENTIONS.map((i) => [i.slug, i]));

/** Build one intention page (body + head metadata + JSON-LD) as a SeoPage. */
function buildIntention(it: Intention): SeoPage {
  const path = intentionPath(it.slug);

  const psalmsList = it.psalms
    .map((n) => `<li><a href="${tehilimReaderHref(n)}">Tehilim ${n}</a></li>`)
    .join("\n        ");

  const related = it.related
    .map((slug) => intentionBySlug.get(slug))
    .filter((r): r is Intention => Boolean(r))
    .map((r) => `<li><a href="${intentionPath(r.slug)}">${r.cardTitle}</a></li>`)
    .join("\n        ");

  const bodyHtml = `
  <main class="seo-article">
    <h1>${it.h1}</h1>
    <p class="seo-lead">${it.lead}</p>

    <p><a class="seo-cta" href="${SHARE_NEW_SESSION}">Organiser un partage de Tehilim pour cette intention</a></p>

    <section class="seo-section" aria-labelledby="psaumes-title">
      <h2 id="psaumes-title">Psaumes (Tehilim) à lire</h2>
      <p>Psaumes traditionnellement lus pour cette intention&nbsp;:</p>
      <ul class="tehilim-psalms">
        ${psalmsList}
      </ul>
      ${it.psalmsNote ? `<p>${it.psalmsNote}</p>` : ""}
      <p class="seo-note"><em>${TEHILIM_DISCLAIMER}</em></p>
    </section>

    <section class="seo-section">
      <h2>Comment partager ces Tehilim</h2>
      <ol>
        <li>Créez une <a href="${SHARE_NEW_SESSION}">session de partage</a> de type Tehilim et précisez l'intention (et le nom concerné) dans la description.</li>
        <li>Sélectionnez les chapitres à lire, ou tout le sefer Tehilim.</li>
        <li>Partagez le lien avec votre famille, vos amis ou votre communauté&nbsp;: chacun réserve et lit ses chapitres, même sans compte.</li>
        <li>Suivez la progression en temps réel jusqu'à terminer les Tehilim ensemble.</li>
      </ol>
      <p><a class="seo-cta" href="${SHARE_NEW_SESSION}">Organiser un partage de Tehilim</a></p>
    </section>

    ${faqHtml(it.faq, "Questions fréquentes")}

    <section class="seo-section">
      <h2>Autres intentions &amp; ressources</h2>
      <ul>
        ${related ? related + "\n        " : ""}<li><a href="${TEHILIM_HUB_PATH}">Toutes les intentions (Tehilim par intention)</a></li>
        <li><a href="/partage-tehilim">Partage de Tehilim à plusieurs</a></li>
        <li><a href="/etude">Étude libre des textes</a></li>
      </ul>
    </section>
  </main>`;

  return {
    file: `tehilim/${it.slug}.html`,
    path,
    title: it.title,
    description: it.description,
    sitemap: { priority: 0.8, changefreq: "monthly" },
    bodyHtml,
    jsonLd: [
      breadcrumb([
        { name: "Accueil", path: "/" },
        { name: "Tehilim par intention", path: TEHILIM_HUB_PATH },
        { name: it.cardTitle, path },
      ]),
      faqJsonLd(it.faq),
    ],
  };
}

/** Build the hub page listing every intention. */
function buildTehilimHub(): SeoPage {
  const cards = INTENTIONS.map(
    (it) => `
        <li>
          <a class="tehilim-card" href="${intentionPath(it.slug)}">
            <span class="tehilim-card-icon"><i class="fa-solid ${it.icon}" aria-hidden="true"></i></span>
            <span class="tehilim-card-title">${it.cardTitle}</span>
            <span class="tehilim-card-desc">${it.cardDesc}</span>
            <span class="tehilim-card-cta">Voir les psaumes <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
          </a>
        </li>`,
  ).join("");

  const bodyHtml = `
  <main class="seo-article">
    <h1>Tehilim par intention</h1>
    <p class="seo-lead">
      À chaque moment de la vie correspondent des Tehilim (Psaumes) que l'on a coutume de lire&nbsp;:
      pour la guérison d'un malade, à la mémoire d'un défunt, pour la subsistance ou la protection…
      Retrouvez les psaumes traditionnellement lus pour chaque intention, et organisez un partage
      pour les terminer à plusieurs.
    </p>

    <p><a class="seo-cta" href="${SHARE_NEW_SESSION}">Organiser un partage de Tehilim</a></p>

    <section class="seo-section">
      <h2>Choisir une intention</h2>
      <ul class="tehilim-cards">${cards}
      </ul>
    </section>

    <section class="seo-section">
      <h2>Lire les Tehilim à plusieurs</h2>
      <p>
        Lire un sefer Tehilim entier (150 psaumes) prend du temps&nbsp;; en se répartissant les
        chapitres, un groupe peut le terminer en quelques minutes. Découvrez comment
        <a href="/partage-tehilim">partager les Tehilim à plusieurs</a> ou lancez directement une
        <a href="${SHARE_NEW_SESSION}">session de partage</a>.
      </p>
      <p class="seo-note"><em>${TEHILIM_DISCLAIMER}</em></p>
    </section>
  </main>`;

  return {
    file: "tehilim.html",
    path: TEHILIM_HUB_PATH,
    title: "Tehilim par intention : quels psaumes lire et pourquoi | Petite Jérusalem",
    description:
      "Quels Tehilim (Psaumes) lire selon l'intention : guérison d'un malade (refoua chelema), à la mémoire d'un défunt, parnassa, protection… Listes des psaumes et partage à plusieurs.",
    sitemap: { priority: 0.9, changefreq: "monthly" },
    bodyHtml,
    jsonLd: [
      breadcrumb([
        { name: "Accueil", path: "/" },
        { name: "Tehilim par intention", path: TEHILIM_HUB_PATH },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Tehilim par intention",
        itemListElement: INTENTIONS.map((it, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: it.cardTitle,
          url: `${SITE_URL}${intentionPath(it.slug)}`,
        })),
      },
    ],
  };
}

export const tehilimHub: SeoPage = buildTehilimHub();
export const tehilimIntentionPages: SeoPage[] = INTENTIONS.map(buildIntention);
/** Hub + intention pages, consumed at runtime by TehilimPage.vue. */
export const tehilimPages: SeoPage[] = [tehilimHub, ...tehilimIntentionPages];

/** All pages that the prerender script turns into static HTML files. */
export const allPages: SeoPage[] = [...appPages, ...landingAsSeoPages, ...tehilimPages];

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

export type SitemapEntry = { path: string; priority: number; changefreq: string };

/**
 * Build sitemap.xml from the indexable pages, plus any `extra` URLs (e.g. the
 * 150 Tehilim chapter pages, which are generated outside `allPages` to keep the
 * SPA bundle small). `lastmod` is an ISO date string.
 */
export function buildSitemap(lastmod: string, extra: SitemapEntry[] = []): string {
  const fromPages: SitemapEntry[] = allPages
    .filter((p) => p.sitemap !== false)
    .map((p) => {
      const s = p.sitemap || { priority: 0.5, changefreq: "weekly" };
      return { path: p.path, priority: s.priority, changefreq: s.changefreq };
    });

  const urls = [...fromPages, ...extra]
    .map((s) =>
      [
        "  <url>",
        `    <loc>${SITE_URL}${s.path === "/" ? "/" : s.path}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${s.changefreq}</changefreq>`,
        `    <priority>${s.priority.toFixed(1)}</priority>`,
        "  </url>",
      ].join("\n"),
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
