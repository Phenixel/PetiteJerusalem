import { describe, expect, it } from "vitest";
import { festivalLinks } from "../content/festivalLinks";
import { SEO_FESTIVALS } from "../content/zmanimFestivals";
import { SEO_LOCALES, sectionPath } from "../content/seoLocales";
import { LISTED_CORPORA, corpusPath, hubPath, studyEntries } from "../content/etudeTexts";
import { allPages } from "../content/seoPages";

/**
 * Les liens posés sous une fête (« Aller plus loin ») mènent à des pages qui
 * existent vraiment.
 *
 * C'est tout l'enjeu du bloc : il est là pour qu'un visiteur venu d'un moteur
 * sur /calendrier/souccot ait où aller. Un lien mort n'y mènerait pas, et une
 * page prérendue qui promet une adresse absente est pire qu'un bloc vide.
 */

/** Toutes les adresses que le site sert, hors pages de fête elles-mêmes. */
function knownPaths(): Set<string> {
  const paths = new Set<string>();
  for (const corpus of LISTED_CORPORA) paths.add(corpusPath(corpus));
  for (const entry of studyEntries) paths.add(hubPath(entry));
  for (const page of allPages) paths.add(page.path);
  for (const locale of SEO_LOCALES) {
    for (const key of ["horaires", "calendrier", "zmanim", "paracha", "partageTehilim"] as const) {
      paths.add(sectionPath(key, locale));
    }
  }
  return paths;
}

describe("liens des pages de fête", () => {
  const paths = knownPaths();

  it("mène à des pages qui existent, dans les trois langues", () => {
    const dead: string[] = [];
    for (const festival of SEO_FESTIVALS) {
      for (const link of festivalLinks(festival.slugs.fr)) {
        for (const locale of SEO_LOCALES) {
          const path = link.path(locale);
          if (!paths.has(path)) dead.push(`${festival.slugs.fr} → ${path}`);
        }
      }
    }
    expect(dead).toEqual([]);
  });

  it("propose au moins deux chemins à chaque fête", () => {
    const poor = SEO_FESTIVALS.filter((f) => festivalLinks(f.slugs.fr).length < 2).map(
      (f) => f.slugs.fr,
    );
    expect(poor).toEqual([]);
  });

  it("nomme chaque lien dans les trois langues", () => {
    for (const festival of SEO_FESTIVALS) {
      for (const link of festivalLinks(festival.slugs.fr)) {
        for (const locale of SEO_LOCALES) {
          expect(link.labels[locale]?.length ?? 0).toBeGreaterThan(10);
        }
      }
    }
  });
});
