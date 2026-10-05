import { HDate } from "@hebcal/core";
import { describe, expect, it } from "vitest";
import { festivalEntryKey, SEO_FESTIVALS } from "../content/zmanimFestivals";
import { SEO_LOCALES } from "../content/seoLocales";
import { DEFAULT_PLACE, yearCalendar, type ZmanimPlace } from "../services/zmanimService";

/**
 * La page d'une fête (/calendrier/:fete) s'ouvre sur l'année de sa prochaine
 * occurrence et met son bloc en avant. Elle comparait le nom entier de
 * l'entrée : le bloc de diaspora « Chemini Atzéret · Simhat Torah » ne
 * répondait ni à l'une ni à l'autre, Hochaana Rabba (sans nom chez hebcal)
 * à rien, et Simhat Torah en Israël (fondue dans Chemini Atzéret) non plus.
 * La page sautait de deux ans, sans rien mettre en avant.
 */

const JERUSALEM: ZmanimPlace = {
  source: "city",
  latitude: 31.769,
  longitude: 35.2163,
  tzid: "Asia/Jerusalem",
  city: "Jérusalem",
};

const START_5787 = new HDate(1, "Tishrei", 5787).abs();

describe("la page de chaque fête trouve son occurrence", () => {
  for (const [label, place] of [
    ["Paris", DEFAULT_PLACE],
    ["Jérusalem", JERUSALEM],
  ] as const) {
    for (const locale of SEO_LOCALES) {
      it(`${label}, ${locale} : dans l'année qui s'ouvre`, () => {
        const entries = yearCalendar(place, 5787, locale);
        const missing = SEO_FESTIVALS.filter(
          (festival) => festivalEntryKey(entries, festival, locale, START_5787) === null,
        ).map((festival) => festival.slugs.fr);
        expect(missing).toEqual([]);
      });
    }
  }

  it("Hochaana Rabba ouvre le bloc de Souccot, et pas un autre", () => {
    const entries = yearCalendar(DEFAULT_PLACE, 5787, "fr");
    const hochaana = SEO_FESTIVALS.find((f) => f.slugs.fr === "hochaana-rabba")!;
    const souccot = SEO_FESTIVALS.find((f) => f.slugs.fr === "souccot")!;
    expect(festivalEntryKey(entries, hochaana, "fr", START_5787)).toBe(
      festivalEntryKey(entries, souccot, "fr", START_5787),
    );
  });

  it("Simhat Torah et Chemini Atséret ouvrent le même bloc en diaspora", () => {
    const entries = yearCalendar(DEFAULT_PLACE, 5787, "fr");
    const [chemini, simhat] = ["chemini-atseret", "simhat-torah"].map(
      (slug) => SEO_FESTIVALS.find((f) => f.slugs.fr === slug)!,
    );
    const key = festivalEntryKey(entries, chemini, "fr", START_5787);
    expect(key).not.toBeNull();
    expect(festivalEntryKey(entries, simhat, "fr", START_5787)).toBe(key);
  });

  it("une fête passée cette année n'est pas trouvée (la page passe à l'année suivante)", () => {
    const entries = yearCalendar(DEFAULT_PLACE, 5787, "fr");
    const afterSouccot = new HDate(25, "Tishrei", 5787).abs();
    for (const slug of ["hochaana-rabba", "simhat-torah"]) {
      const festival = SEO_FESTIVALS.find((f) => f.slugs.fr === slug)!;
      expect(festivalEntryKey(entries, festival, "fr", afterSouccot)).toBeNull();
    }
  });
});
