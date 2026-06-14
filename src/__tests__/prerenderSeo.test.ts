import { describe, it, expect } from "vitest";
// @ts-expect-error - plain ESM build script without type declarations
import { injectMeta, escapeAttr, staticPages, SITE_URL } from "../../scripts/prerender-seo.mjs";

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
  <body></body>
</html>`;

describe("prerender-seo injectMeta", () => {
  const page = {
    file: "share-reading.html",
    path: "/share-reading",
    title: "Mon titre de page",
    description: "Ma description de page",
  };

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

  it("conserve l'image og partagée", () => {
    const html = injectMeta(template, page);
    expect(html).toContain(`content="${SITE_URL}/og-image.jpg"`);
  });

  it("applique robots uniquement quand fourni", () => {
    const indexed = injectMeta(template, page);
    expect(indexed).toContain('<meta name="robots" content="index, follow" />');

    const noindex = injectMeta(template, { ...page, robots: "noindex, follow" });
    expect(noindex).toContain('<meta name="robots" content="noindex, follow" />');
  });

  it("échappe les caractères spéciaux des attributs", () => {
    expect(escapeAttr('Titre & "test" <x>')).toBe("Titre &amp; &quot;test&quot; &lt;x&gt;");
  });
});

describe("prerender-seo staticPages", () => {
  it("déclare des routes uniques avec les champs requis", () => {
    const paths = new Set<string>();
    for (const p of staticPages as Array<{ file: string; path: string; title: string; description: string }>) {
      expect(p.file).toMatch(/\.html$/);
      expect(p.path.startsWith("/")).toBe(true);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
      paths.add(p.path);
    }
    expect(paths.size).toBe((staticPages as unknown[]).length);
  });
});
