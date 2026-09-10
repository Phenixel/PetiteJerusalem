import { describe, it, expect, beforeEach, vi } from "vitest";
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

// La bibliothèque ne propose que la dernière lecture : refermer la ligne ne
// fait pas remonter la précédente, un texte après l'autre.
describe("ligne de reprise de la bibliothèque", () => {
  beforeEach(() => localStorage.clear());

  const troisLectures = () =>
    localStorage.setItem(
      POSITIONS_KEY,
      JSON.stringify({
        "103": position("103", "/bibliotheque/tehilim/1", 10),
        "104": position("104", "/bibliotheque/tehilim/2", 20),
        "105": position("105", "/bibliotheque/tehilim/3", 30),
      }),
    );

  it("propose la plus récente, et rien après un refus", () => {
    troisLectures();
    expect(readingProgressService.getResumePosition()?.textId).toBe("105");

    readingProgressService.dismissResume("105");
    expect(readingProgressService.getResumePosition()).toBeNull();
    // Les autres textes rouvrent toujours là où on les avait laissés.
    expect(readingProgressService.getPosition("104")?.line).toBe(12);
  });

  it("revient dès qu'on lit de nouveau", () => {
    troisLectures();
    // Horloge tenue à la main : le refus et la lecture qui suit tomberaient
    // sinon dans la même milliseconde, et la comparaison n'aurait rien à voir.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T10:00:00Z"));
    readingProgressService.dismissResume("105");
    vi.setSystemTime(new Date("2026-09-10T10:05:00Z"));

    readingProgressService.savePosition({
      textId: "104",
      section: null,
      line: 3,
      path: "/bibliotheque/tehilim/2",
      label: "Tehilim 2",
    });
    expect(readingProgressService.getResumePosition()?.textId).toBe("104");
    vi.useRealTimers();
  });
});
