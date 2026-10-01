import { describe, expect, it } from "vitest";
import {
  markReadingEntry,
  READING_HINT_TTL_MS,
  readingEntryFromPath,
  takeReadingEntry,
} from "../services/readingEntry";

/**
 * `text_opened.entry` : d'où vient la lecture. La page précédente le dit le
 * plus souvent ; un indice laissé juste avant la navigation dit ce que
 * l'adresse ne dit pas (un résultat de recherche, une reprise, une
 * notification), et il ne survit pas à la lecture qu'il annonçait.
 */

describe("l'entrée d'une lecture, d'après la page précédente", () => {
  it.each([
    [null, "direct"],
    ["", "direct"],
    ["/", "home"],
    ["/en", "home"],
    ["/bibliotheque", "library"],
    ["/bibliotheque/tehilim", "library"],
    ["/bibliotheque/lecture-du-jour", "daily_reading"],
    ["/bibliotheque/chnei-mikra", "chnei_mikra"],
    ["/bibliotheque/tehilim-du-jour", "tehilim_day"],
    ["/bibliotheque/tehilim/23", "reading"],
    ["/bibliotheque/sidour/minha?verset=4", "reading"],
    ["/lire/123", "reading"],
    ["/share-reading/session/une-chaine", "session"],
    ["/horaires", "zmanim"],
    ["/en/shabbat-times/london", "zmanim"],
    ["/he/chagim", "calendar"],
    ["/calendrier/souccot", "calendar"],
    ["/profile", "other"],
  ])("%s → %s", (back, entry) => {
    expect(readingEntryFromPath(back)).toBe(entry);
  });
});

describe("l'indice laissé avant la navigation", () => {
  it("l'emporte sur la page précédente, une seule fois", () => {
    markReadingEntry("search", 1_000);
    expect(takeReadingEntry("/bibliotheque", { session: false, now: 2_000 })).toBe("search");
    expect(takeReadingEntry("/bibliotheque", { session: false, now: 3_000 })).toBe("library");
  });

  it("ne vaut plus rien au-delà de quelques secondes", () => {
    markReadingEntry("resume", 0);
    expect(takeReadingEntry("/", { session: false, now: READING_HINT_TTL_MS + 1 })).toBe("home");
  });

  it("cède devant une chaîne, et ne reste pas en réserve", () => {
    markReadingEntry("push", 0);
    expect(takeReadingEntry(null, { session: true, now: 10 })).toBe("session");
    expect(takeReadingEntry(null, { session: false, now: 20 })).toBe("direct");
  });
});
