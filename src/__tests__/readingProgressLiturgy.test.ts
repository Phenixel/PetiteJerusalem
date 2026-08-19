import { describe, it, expect, beforeEach } from "vitest";
import { readingProgressService, type ReadingPosition } from "../services/readingProgressService";

// Liturgie (Sli'hot, Brahot) : pas de « reprendre là où vous étiez ». Les
// positions héritées d'une version antérieure sont purgées à la lecture.

const POSITIONS_KEY = "pj-reading-positions";

const position = (textId: string, path: string, at: number): ReadingPosition => ({
  textId,
  section: null,
  line: 12,
  path,
  label: textId,
  at,
});

describe("reprise de lecture et liturgie", () => {
  beforeEach(() => localStorage.clear());

  it("purge les positions liturgiques héritées et ne les propose plus", () => {
    localStorage.setItem(
      POSITIONS_KEY,
      JSON.stringify({
        "342": position("342", "/bibliotheque/brahot/birkat-hamazon", 20),
        "340": position("340", "/bibliotheque/slihot/slihot", 30),
        "103": position("103", "/bibliotheque/tehilim/1", 10),
      }),
    );
    // La plus récente est liturgique : c'est le Tehilim qui doit ressortir.
    expect(readingProgressService.getLastPosition()?.textId).toBe("103");
    expect(readingProgressService.getPosition("342")).toBeNull();
    // Et le stockage est nettoyé (la prochaine écriture cloud emporte la purge).
    const stored = JSON.parse(localStorage.getItem(POSITIONS_KEY)!);
    expect(Object.keys(stored)).toEqual(["103"]);
  });

  it("laisse les positions ordinaires intactes", () => {
    localStorage.setItem(
      POSITIONS_KEY,
      JSON.stringify({ "103": position("103", "/bibliotheque/tehilim/1", 10) }),
    );
    expect(readingProgressService.getLastPosition()?.textId).toBe("103");
  });
});
