import { describe, it, expect } from "vitest";
import { moderationService, ModerationError } from "../services/moderationService";

describe("moderationService.findBannedWord", () => {
  it("détecte un mot interdit tel quel", () => {
    expect(moderationService.findBannedWord("session de pute")).toBe("pute");
  });

  it("détecte malgré majuscules et accents", () => {
    expect(moderationService.findBannedWord("Quel ENCULÉ")).toBe("encule");
  });

  it("détecte les chiffres « leet »", () => {
    expect(moderationService.findBannedWord("m3rde alors")).toBe("merde");
  });

  it("détecte une expression de plusieurs mots", () => {
    // « sale » et « race » sont anodins seuls : seule l'expression est interdite.
    expect(moderationService.findBannedWord("bande de sale race")).toBe("sale race");
  });

  it("détecte l'hébreu", () => {
    expect(moderationService.findBannedWord("איזה חרא")).toBe("חרא");
  });

  it("ne déclenche pas sur un mot contenant un terme interdit", () => {
    // « députée » contient « pute », « calcul » contient « cul » : la
    // comparaison mot à mot ne doit pas les signaler.
    expect(moderationService.findBannedWord("La députée fait un calcul")).toBeNull();
  });

  it("laisse passer un texte ordinaire (français, hébreu)", () => {
    expect(moderationService.findBannedWord("Étude de la Paracha עם ישראל חי")).toBeNull();
  });

  it("laisse passer un texte vide", () => {
    expect(moderationService.findBannedWord("")).toBeNull();
  });
});

describe("moderationService.assertClean", () => {
  it("lève une ModerationError avec le terme en cause", () => {
    expect(() => moderationService.assertClean("titre correct", "quel connard")).toThrowError(
      ModerationError,
    );
    try {
      moderationService.assertClean("quel connard");
    } catch (error) {
      expect(error).toBeInstanceOf(ModerationError);
      expect((error as ModerationError).word).toBe("connard");
    }
  });

  it("ignore les valeurs absentes", () => {
    expect(() => moderationService.assertClean(undefined, "", "texte sain")).not.toThrow();
  });
});
