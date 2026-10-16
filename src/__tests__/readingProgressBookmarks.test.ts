import { describe, it, expect, beforeEach } from "vitest";
import { readingProgressService } from "../services/readingProgressService";

// Un seul marque-page par livre (voir toggleBookmark) : en poser un nouveau
// retire l'ancien du même texte, sans toucher aux autres livres ni à
// l'espace de la lecture du jour.

const mark = (textId: string, line: number, scope: "library" | "daily" = "library") =>
  readingProgressService.toggleBookmark({
    textId,
    section: 1,
    line,
    path: `/bibliotheque/tanakh/${textId}/1`,
    label: textId,
    scope,
  });

describe("un marque-page par livre", () => {
  beforeEach(() => localStorage.clear());

  it("le nouveau marque-page remplace l'ancien du même livre", () => {
    expect(mark("berechit", 3)).toBe(true);
    expect(mark("berechit", 9)).toBe(true);
    expect(readingProgressService.getBookmarks("berechit").map((b) => b.line)).toEqual([9]);
    // L'ancien est enterré, pour que la fusion avec le compte ne le ramène pas.
    const tombstones = JSON.parse(localStorage.getItem("pj-bookmark-tombstones")!);
    expect(Object.keys(tombstones)).toEqual(["berechit#1#3"]);
  });

  it("les autres livres et la lecture du jour gardent le leur", () => {
    mark("berechit", 3);
    mark("chemot", 4);
    mark("berechit", 5, "daily");
    mark("berechit", 9);
    expect(readingProgressService.getBookmarks("chemot")).toHaveLength(1);
    expect(readingProgressService.getBookmarks("berechit", "daily")).toHaveLength(1);
    expect(readingProgressService.getBookmarks("berechit").map((b) => b.line)).toEqual([9]);
  });

  it("retirer le marque-page posé ne laisse rien", () => {
    mark("berechit", 3);
    expect(mark("berechit", 3)).toBe(false);
    expect(readingProgressService.getBookmarks("berechit")).toEqual([]);
  });
});
