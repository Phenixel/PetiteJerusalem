import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEO_LOCALE,
  SECTION_SLUGS,
  SEO_LOCALES,
  alternatesOf,
  fileForPath,
  isSectionPath,
  localeOfPath,
  sectionPath,
  translatePath,
  type SeoLocale,
  type SeoSection,
} from "../content/seoLocales";
import { allPages, footerHtml, injectMeta, buildSitemap } from "../content/seoPages";
import { buildZmanimSeoPages } from "../content/zmanimSeoPages";
import { buildParashaSeoPages } from "../content/parashaSeoPages";
import { SEO_FESTIVALS } from "../content/zmanimFestivals";

const NOW = new Date("2026-08-21T10:00:00Z");
const sections = Object.keys(SECTION_SLUGS) as SeoSection[];

describe("le modèle des URL par langue", () => {
  it("laisse le français à la racine et préfixe les autres", () => {
    expect(sectionPath("horaires", "fr")).toBe("/horaires");
    expect(sectionPath("horaires", "en")).toBe("/en/shabbat-times");
    expect(sectionPath("horaires", "he")).toBe("/he/zmanei-shabbat");
    expect(sectionPath("home", "fr")).toBe("/");
    expect(sectionPath("home", "en")).toBe("/en");
  });

  it("ajoute les segments qui suivent, sans barre finale", () => {
    expect(sectionPath("horaires", "en", "lyon")).toBe("/en/shabbat-times/lyon");
    expect(sectionPath("calendrier", "he", "pesach")).toBe("/he/chagim/pesach");
    for (const locale of SEO_LOCALES) {
      for (const section of sections) {
        const path = sectionPath(section, locale);
        expect(path.startsWith("/")).toBe(true);
        expect(path === "/" || !path.endsWith("/")).toBe(true);
      }
    }
  });

  it("donne un slug unique par section dans chaque langue", () => {
    for (const locale of SEO_LOCALES) {
      const slugs = sections.filter((s) => s !== "home").map((s) => SECTION_SLUGS[s][locale]);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("reconnaît la langue d'un chemin", () => {
    expect(localeOfPath("/horaires/lyon")).toBe("fr");
    expect(localeOfPath("/en/shabbat-times")).toBe("en");
    expect(localeOfPath("/he/chagim/pesach")).toBe("he");
    // Une ville qui s'appellerait « en » ne ferait pas basculer la langue :
    // le préfixe est un segment entier, en tête.
    expect(localeOfPath("/horaires/en")).toBe("fr");
  });

  it("traduit un chemin d'une langue à l'autre, dans les deux sens", () => {
    expect(translatePath("/horaires/lyon", "en")).toBe("/en/shabbat-times/lyon");
    expect(translatePath("/en/shabbat-times/lyon", "fr")).toBe("/horaires/lyon");
    expect(translatePath("/he/chagim/pesach", "en")).toBe("/en/holidays/pesach");
    expect(translatePath("/", "he")).toBe("/he");
    // Une section non traduite n'a qu'une adresse : on ne bouge pas.
    expect(translatePath("/bibliotheque/tanakh", "en")).toBeNull();
  });

  it("reconnaît une section quelle que soit la langue du chemin", () => {
    expect(isSectionPath("/horaires", "horaires")).toBe(true);
    expect(isSectionPath("/he/zmanei-shabbat/lyon", "horaires")).toBe(true);
    expect(isSectionPath("/en/holidays/passover", "calendrier")).toBe(true);
    expect(isSectionPath("/bibliotheque", "horaires")).toBe(false);
  });

  it("dérive le fichier statique du chemin", () => {
    expect(fileForPath("/")).toBe("index.html");
    expect(fileForPath("/en/shabbat-times/lyon")).toBe("en/shabbat-times/lyon.html");
  });
});

describe("les pages prérendues, langue par langue", () => {
  const zmanim = buildZmanimSeoPages(NOW).pages;
  const parasha = buildParashaSeoPages(NOW).pages;
  const pages = [...allPages, ...zmanim, ...parasha];

  it("n'a jamais deux pages au même chemin", () => {
    const paths = pages.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("écrit chaque page traduite dans les trois langues", () => {
    const byPath = new Set(pages.map((p) => p.path));
    for (const section of ["horaires", "calendrier", "zmanim", "paracha", "home"] as SeoSection[]) {
      for (const locale of SEO_LOCALES) {
        expect(byPath.has(sectionPath(section, locale))).toBe(true);
      }
    }
    // Et une page de ville et de fête dans chaque langue.
    for (const locale of SEO_LOCALES) {
      expect(byPath.has(sectionPath("horaires", locale, "lyon"))).toBe(true);
      for (const festival of SEO_FESTIVALS) {
        expect(byPath.has(sectionPath("calendrier", locale, festival.slugs[locale]))).toBe(true);
      }
    }
  });

  it("déclare des alternates qui pointent vers des pages qui existent", () => {
    const byPath = new Set(pages.map((p) => p.path));
    for (const page of pages) {
      if (!page.alternates) continue;
      for (const locale of SEO_LOCALES) {
        const alternate = page.alternates[locale];
        if (alternate) expect(byPath.has(alternate)).toBe(true);
      }
      // Une page traduite se déclare elle-même parmi ses alternates.
      expect(Object.values(page.alternates)).toContain(page.path);
    }
  });

  it("chaque page traduite porte sa langue", () => {
    for (const page of pages) {
      if (page.path.startsWith("/en/")) expect(page.locale).toBe("en");
      if (page.path.startsWith("/he/")) expect(page.locale).toBe("he");
    }
  });
});

describe("le head d'une page traduite", () => {
  const template = [
    '<html lang="fr">',
    "<head>",
    "<title>t</title>",
    '<meta name="description" content="d" />',
    '<link rel="canonical" href="https://petite-jerusalem.fr/" />',
    '<meta property="og:url" content="https://petite-jerusalem.fr/" />',
    '<meta property="og:title" content="t" />',
    '<meta property="og:description" content="d" />',
    '<meta name="twitter:title" content="t" />',
    '<meta name="twitter:description" content="d" />',
    '<meta property="og:locale" content="fr_FR" />',
    '<meta property="og:locale:alternate" content="en_US" />',
    '<meta property="og:locale:alternate" content="he_IL" />',
    "</head>",
  ].join("\n");

  const page = {
    file: "he/zmanei-shabbat.html",
    path: "/he/zmanei-shabbat",
    locale: "he" as SeoLocale,
    alternates: alternatesOf("horaires"),
    title: "זמני שבת",
    description: "תיאור",
    bodyHtml: "",
  };
  const html = injectMeta(template, page);

  it("écrit la langue et le sens d'écriture sur le document", () => {
    expect(html).toContain('<html lang="he" dir="rtl">');
  });

  it("pose le canonique de sa propre adresse", () => {
    expect(html).toContain('href="https://petite-jerusalem.fr/he/zmanei-shabbat"');
  });

  it("déclare ses sœurs en hreflang, x-default sur le français", () => {
    expect(html).toContain('hreflang="fr" href="https://petite-jerusalem.fr/horaires"');
    expect(html).toContain('hreflang="en" href="https://petite-jerusalem.fr/en/shabbat-times"');
    expect(html).toContain('hreflang="he" href="https://petite-jerusalem.fr/he/zmanei-shabbat"');
    expect(html).toContain('hreflang="x-default" href="https://petite-jerusalem.fr/horaires"');
  });

  it("met sa langue en og:locale, les autres en alternate", () => {
    expect(html).toContain('<meta property="og:locale" content="he_IL" />');
    expect(html).toContain('<meta property="og:locale:alternate" content="fr_FR" />');
    expect(html).toContain('<meta property="og:locale:alternate" content="en_US" />');
    expect(html.match(/property="og:locale"/g)).toHaveLength(1);
  });

  it("laisse une page française telle qu'elle était", () => {
    const fr = injectMeta(template, { ...page, locale: DEFAULT_SEO_LOCALE, path: "/horaires" });
    expect(fr).toContain('<html lang="fr">');
    expect(fr).not.toContain('dir="rtl"');
    expect(fr).toContain('<meta property="og:locale" content="fr_FR" />');
  });
});

describe("le pied de page et le sitemap", () => {
  it("traduit le pied de page et ses adresses", () => {
    expect(footerHtml("fr")).toContain('href="/horaires"');
    expect(footerHtml("en")).toContain('href="/en/shabbat-times"');
    expect(footerHtml("en")).toContain("Shabbat times");
    expect(footerHtml("he")).toContain('href="/he/zmanei-shabbat"');
    expect(footerHtml("he")).toContain("זמני שבת");
    // Les sections non traduites gardent leur unique adresse.
    expect(footerHtml("en")).toContain('href="/bibliotheque"');
  });

  it("porte les alternates dans le sitemap", () => {
    const xml = buildSitemap("2026-08-21");
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="en" href="https://petite-jerusalem.fr/en/finish-the-shas" />',
    );
    expect(xml).toContain('hreflang="x-default"');
  });
});
