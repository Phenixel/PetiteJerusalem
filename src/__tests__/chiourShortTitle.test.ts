import { describe, expect, it } from "vitest";
import { shortTitle, titleWithSerie } from "../composables/useChiourPlayback";

/**
 * Dans une liste où la série est déjà dite (la page d'une série, la file du
 * lecteur), un titre de cours ne la répète pas (shortTitle).
 */
describe("titre court d'un cours", () => {
  it("retire le nom de la série qu'il répète", () => {
    expect(shortTitle("Shaar Habitahon Shiour 10 Chapitre 2 partie 2", "Shaar Habitahon")).toBe(
      "Shiour 10 Chapitre 2 partie 2",
    );
    expect(shortTitle("Pélé Yoets - Ahava (l'amour de HaShem) n°1", "Pélé Yoets")).toBe(
      "Ahava (l'amour de HaShem) n°1",
    );
    expect(shortTitle("Pélé Yoets cours n°8 : l'amour", "Pélé Yoets")).toBe(
      "Cours n°8 : l'amour",
    );
  });

  it("ignore accents et majuscules pour comparer", () => {
    expect(shortTitle("PELE YOETS - Emet", "Pélé Yoets")).toBe("Emet");
  });

  it("garde un titre qui ne commence pas par la série, ou qui n'est qu'elle", () => {
    expect(shortTitle("Se taire : la force maîtresse", "Pélé Yoets")).toBe(
      "Se taire : la force maîtresse",
    );
    expect(shortTitle("Shaar Habitahon", "Shaar Habitahon")).toBe("Shaar Habitahon");
    expect(shortTitle("Shaar Habitahon 1", null)).toBe("Shaar Habitahon 1");
  });
});

/**
 * Là où la série n'est pas dite (l'onglet, le partage, l'aperçu d'un lien),
 * un titre qui ne la répète plus la reprend après lui (titleWithSerie).
 */
describe("titre d'un cours avec sa série", () => {
  it("ajoute la série à un titre qui ne la dit pas", () => {
    expect(titleWithSerie("Chapitre 3 (2/7)", "Shaar Habitahon")).toBe(
      "Chapitre 3 (2/7) · Shaar Habitahon",
    );
  });

  it("ne la répète pas quand le titre la contient déjà, accents et majuscules ignorés", () => {
    expect(titleWithSerie("Shaar Habitahon Shiour 12", "Shaar Habitahon")).toBe(
      "Shaar Habitahon Shiour 12",
    );
    expect(titleWithSerie("PELE YOETS - Emet", "Pélé Yoets")).toBe("PELE YOETS - Emet");
  });

  it("laisse le titre seul sans série", () => {
    expect(titleWithSerie("Se taire : la force maîtresse", null)).toBe(
      "Se taire : la force maîtresse",
    );
  });
});
