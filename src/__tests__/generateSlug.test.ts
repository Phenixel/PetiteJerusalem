import { describe, it, expect } from "vitest";
import { generateSlug } from "../services/slugService";

describe("generateSlug", () => {
  describe("diacritiques français", () => {
    it("remplace é, è, ê, ë par e", () => {
      expect(generateSlug("été")).toBe("ete");
      expect(generateSlug("fête")).toBe("fete");
      expect(generateSlug("noël")).toBe("noel");
    });

    it("remplace à, â, ä par a", () => {
      expect(generateSlug("pâte")).toBe("pate");
      expect(generateSlug("à")).toBe("a");
    });

    it("remplace î, ï par i", () => {
      expect(generateSlug("île")).toBe("ile");
      expect(generateSlug("naïf")).toBe("naif");
    });

    it("remplace ô, ö par o", () => {
      expect(generateSlug("côte")).toBe("cote");
    });

    it("remplace û, ü, ù par u", () => {
      expect(generateSlug("sûr")).toBe("sur");
      expect(generateSlug("où")).toBe("ou");
    });

    it("remplace ç par c", () => {
      expect(generateSlug("façon")).toBe("facon");
      expect(generateSlug("garçon")).toBe("garcon");
    });
  });

  describe("espaces et tirets", () => {
    it("convertit les espaces en tirets", () => {
      expect(generateSlug("hello world")).toBe("hello-world");
    });

    it("collapse les espaces multiples en un seul tiret", () => {
      expect(generateSlug("hello   world")).toBe("hello-world");
    });

    it("trim les espaces en début et fin", () => {
      expect(generateSlug("  hello world  ")).toBe("hello-world");
    });

    it("collapse les tirets consécutifs en un seul", () => {
      expect(generateSlug("hello--world")).toBe("hello-world");
    });
  });

  describe("caractères spéciaux et casse", () => {
    it("supprime les caractères spéciaux", () => {
      expect(generateSlug("hello!@#world")).toBe("helloworld");
    });

    it("conserve les chiffres", () => {
      expect(generateSlug("session 42")).toBe("session-42");
    });

    it("met tout en minuscule", () => {
      expect(generateSlug("Hello World")).toBe("hello-world");
    });
  });

  describe("cas d'usage réels", () => {
    it("génère un slug correct pour un nom de session typique", () => {
      expect(generateSlug("Étude du Talmud Bavli")).toBe("etude-du-talmud-bavli");
    });

    it("gère un nom avec plusieurs diacritiques combinés", () => {
      expect(generateSlug("Réservation Générale")).toBe("reservation-generale");
    });

    it("gère une chaîne sans diacritiques", () => {
      expect(generateSlug("Mishna Berachot")).toBe("mishna-berachot");
    });

    // Les appelants doivent prévoir un repli (voir sessionService.generateUniqueSlug) :
    // un slug vide stocké tel quel casse les liens ?session= de la page de session.
    it("retourne une chaîne vide pour un nom entièrement en hébreu", () => {
      expect(generateSlug("לעילוי נשמת פפי שלום")).toBe("");
    });
  });
});
