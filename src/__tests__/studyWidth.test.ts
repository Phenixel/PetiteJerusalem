import { describe, it, expect, beforeEach } from "vitest";
import { clampStudyWidth, STUDY_MIN, TEXT_ROOM, useStudyWidth } from "../composables/useStudyWidth";

/**
 * La colonne des commentaires se règle en tirant son bord (CommentaryPanel.vue) :
 * la largeur choisie reste dans ce que l'écran permet, se garde sur
 * l'appareil, et se rend à main.css d'un double appui.
 */
describe("la largeur de la colonne des commentaires", () => {
  beforeEach(() => {
    localStorage.clear();
    useStudyWidth().reset();
  });

  it("ne descend pas sous 17 rem et laisse toujours 20 rem au texte", () => {
    expect(clampStudyWidth(100, 1280)).toBe(STUDY_MIN);
    expect(clampStudyWidth(2000, 1280)).toBe(1280 - TEXT_ROOM);
    expect(clampStudyWidth(500.4, 1280)).toBe(500);
    // Un écran trop étroit pour les deux bornes garde la colonne lisible.
    expect(clampStudyWidth(400, 600)).toBe(STUDY_MIN);
  });

  it("écrit la largeur choisie sur la racine et la garde sur l'appareil", () => {
    const width = useStudyWidth();
    width.preview(400);
    width.commit();
    expect(document.documentElement.style.getPropertyValue("--study-width")).toBe("400px");
    expect(localStorage.getItem("pj-study-width")).toBe("400");
  });

  it("rend la main à main.css quand on la rétablit", async () => {
    const width = useStudyWidth();
    width.preview(400);
    width.commit();
    width.reset();
    await Promise.resolve();
    expect(document.documentElement.style.getPropertyValue("--study-width")).toBe("");
    expect(localStorage.getItem("pj-study-width")).toBeNull();
  });
});
