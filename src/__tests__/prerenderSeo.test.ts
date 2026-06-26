import { describe, it, expect } from "vitest";
import {
  injectMeta,
  injectBody,
  renderPage,
  escapeAttr,
  buildSitemap,
  allPages,
  appPages,
  landingPages,
  tehilimHub,
  tehilimIntentionPages,
  tehilimPages,
  SITE_URL,
  type SeoPage,
} from "../content/seoPages";

const template = `<!doctype html>
<html lang="fr">
  <head>
    <title>Petite Jérusalem | Base</title>
    <meta name="description" content="Description de base" />
    <link rel="canonical" href="https://petite-jerusalem.fr/" />
    <meta property="og:title" content="OG base" />
    <meta property="og:description" content="OG desc base" />
    <meta property="og:url" content="https://petite-jerusalem.fr/" />
    <meta property="og:image" content="https://petite-jerusalem.fr/og-image.jpg" />
    <meta name="twitter:title" content="TW base" />
    <meta name="twitter:description" content="TW desc base" />
    <meta name="robots" content="index, follow" />
  </head>
  <body><div id="app"></div></body>
</html>`;

const page: SeoPage = {
  file: "share-reading.html",
  path: "/share-reading",
  title: "Mon titre de page",
  description: "Ma description de page",
  bodyHtml: `<main class="seo-article"><h1>Mon contenu</h1></main>`,
  jsonLd: [{ "@context": "https://schema.org", "@type": "WebPage", name: "Test" }],
};

describe("seoPages injectMeta", () => {
  it("remplace le <title>", () => {
    const html = injectMeta(template, page);
    expect(html).toContain("<title>Mon titre de page</title>");
    expect(html).not.toContain("Petite Jérusalem | Base");
  });

  it("met à jour la meta description", () => {
    const html = injectMeta(template, page);
    expect(html).toContain('<meta name="description" content="Ma description de page" />');
  });

  it("propage le titre dans og:title et twitter:title", () => {
    const html = injectMeta(template, page);
    expect(html).toContain('<meta property="og:title" content="Mon titre de page" />');
    expect(html).toContain('<meta name="twitter:title" content="Mon titre de page" />');
  });

  it("propage la description dans og:description et twitter:description", () => {
    const html = injectMeta(template, page);
    expect(html).toContain('<meta property="og:description" content="Ma description de page" />');
    expect(html).toContain('<meta name="twitter:description" content="Ma description de page" />');
  });

  it("met à jour le canonical et og:url avec l'URL complète de la page", () => {
    const html = injectMeta(template, page);
    const url = `${SITE_URL}/share-reading`;
    expect(html).toContain(`<link rel="canonical" href="${url}" />`);
    expect(html).toContain(`<meta property="og:url" content="${url}" />`);
  });

  it("applique robots uniquement quand fourni", () => {
    const html = injectMeta(template, page);
    expect(html).toContain('<meta name="robots" content="index, follow" />');

    const noindex = injectMeta(template, { ...page, robots: "noindex, follow" });
    expect(noindex).toContain('<meta name="robots" content="noindex, follow" />');
  });

  it("échappe les caractères spéciaux des attributs", () => {
    expect(escapeAttr('Titre & "test" <x>')).toBe("Titre &amp; &quot;test&quot; &lt;x&gt;");
  });
});

describe("seoPages injectBody", () => {
  it("injecte le contenu crawlable dans #app", () => {
    const html = injectBody(template, page);
    expect(html).toContain('<div id="app"><main class="seo-article"><h1>Mon contenu</h1>');
    expect(html).not.toContain('<div id="app"></div>');
  });

  it("inclut le footer de liens internes", () => {
    const html = injectBody(template, page);
    expect(html).toContain('href="/finir-le-chass"');
    expect(html).toContain('href="/partage-tehilim"');
  });

  it("ajoute les blocs JSON-LD fournis dans le <head>", () => {
    const html = injectBody(template, page);
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('"@type":"WebPage"');
  });

  it("renderPage combine head + body", () => {
    const html = renderPage(template, page);
    expect(html).toContain("<title>Mon titre de page</title>");
    expect(html).toContain("<h1>Mon contenu</h1>");
  });
});

describe("seoPages data", () => {
  it("déclare des routes uniques avec les champs requis", () => {
    const paths = new Set<string>();
    for (const p of allPages) {
      expect(p.file).toMatch(/\.html$/);
      expect(p.path.startsWith("/")).toBe(true);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.bodyHtml.length).toBeGreaterThan(0);
      paths.add(p.path);
    }
    expect(paths.size).toBe(allPages.length);
  });

  it("expose l'accueil et les pages de destination clés", () => {
    expect(appPages.some((p) => p.path === "/" && p.file === "index.html")).toBe(true);
    expect(landingPages.map((p) => p.path)).toContain("/finir-le-chass");
    expect(landingPages.map((p) => p.path)).toContain("/partage-tehilim");
  });

  it("cible le bon domaine canonique", () => {
    expect(SITE_URL).toBe("https://petite-jerusalem.fr");
  });
});

describe("seoPages Tehilim par intention", () => {
  it("expose le hub /tehilim et l'ajoute aux pages prérendues + sitemap", () => {
    expect(tehilimHub.path).toBe("/tehilim");
    expect(tehilimHub.file).toBe("tehilim.html");
    expect(allPages).toContain(tehilimHub);
    expect(buildSitemap("2026-06-21")).toContain(
      "<loc>https://petite-jerusalem.fr/tehilim</loc>",
    );
  });

  it("inclut au moins la page modèle refoua-chelema", () => {
    const refoua = tehilimIntentionPages.find((p) => p.path === "/tehilim/refoua-chelema");
    expect(refoua).toBeDefined();
    expect(refoua!.file).toBe("tehilim/refoua-chelema.html");
  });

  it("chaque page intention lie vers le lecteur, le partage et le hub", () => {
    for (const p of tehilimIntentionPages) {
      expect(p.bodyHtml).toMatch(/href="\/bibliotheque\/tehilim\/\d+"/);
      expect(p.bodyHtml).toContain('href="/share-reading/new-session"');
      expect(p.bodyHtml).toContain('href="/tehilim"');
      expect(p.bodyHtml).toContain('href="/partage-tehilim"');
    }
  });

  it("émet le JSON-LD BreadcrumbList + FAQPage sur les pages intention", () => {
    for (const p of tehilimIntentionPages) {
      const types = (p.jsonLd ?? []).map((o) => o["@type"]);
      expect(types).toContain("BreadcrumbList");
      expect(types).toContain("FAQPage");
    }
  });

  it("le hub liste chaque intention disponible", () => {
    for (const p of tehilimIntentionPages) {
      expect(tehilimHub.bodyHtml).toContain(`href="${p.path}"`);
    }
  });

  it("tehilimPages regroupe le hub puis les intentions", () => {
    expect(tehilimPages[0]).toBe(tehilimHub);
    expect(tehilimPages.slice(1)).toEqual(tehilimIntentionPages);
  });
});

describe("seoPages buildSitemap", () => {
  const xml = buildSitemap("2026-06-21");

  it("liste les URLs sur le domaine canonique .fr, jamais .web.app", () => {
    expect(xml).toContain("<loc>https://petite-jerusalem.fr/</loc>");
    expect(xml).toContain("<loc>https://petite-jerusalem.fr/share-reading</loc>");
    expect(xml).toContain("<loc>https://petite-jerusalem.fr/finir-le-chass</loc>");
    expect(xml).not.toContain("web.app");
  });

  it("exclut les pages marquées sitemap:false (ex. /login)", () => {
    expect(xml).not.toContain("<loc>https://petite-jerusalem.fr/login</loc>");
  });

  it("inclut lastmod, changefreq et priority", () => {
    expect(xml).toContain("<lastmod>2026-06-21</lastmod>");
    expect(xml).toContain("<changefreq>");
    expect(xml).toContain("<priority>1.0</priority>");
  });
});
