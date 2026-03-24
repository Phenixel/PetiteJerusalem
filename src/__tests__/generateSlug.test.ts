import { describe, it, expect } from "vitest";
import { UtilsService } from "../services/Services";

describe("UtilsService.generateSlug", () => {
  describe("diacritiques français", () => {
    it("remplace é, è, ê, ë par e", () => {
      expect(UtilsService.generateSlug("été")).toBe("ete");
      expect(UtilsService.generateSlug("fête")).toBe("fete");
      expect(UtilsService.generateSlug("noël")).toBe("noel");
    });

    it("remplace à, â, ä par a", () => {
      expect(UtilsService.generateSlug("pâte")).toBe("pate");
      expect(UtilsService.generateSlug("à")).toBe("a");
    });

    it("remplace î, ï par i", () => {
      expect(UtilsService.generateSlug("île")).toBe("ile");
      expect(UtilsService.generateSlug("naïf")).toBe("naif");
    });

    it("remplace ô, ö par o", () => {
      expect(UtilsService.generateSlug("côte")).toBe("cote");
    });

    it("remplace û, ü, ù par u", () => {
      expect(UtilsService.generateSlug("sûr")).toBe("sur");
      expect(UtilsService.generateSlug("où")).toBe("ou");
    });

    it("remplace ç par c", () => {
      expect(UtilsService.generateSlug("façon")).toBe("facon");
      expect(UtilsService.generateSlug("garçon")).toBe("garcon");
    });
  });

  describe("espaces et tirets", () => {
    it("convertit les espaces en tirets", () => {
      expect(UtilsService.generateSlug("hello world")).toBe("hello-world");
    });

    it("collapse les espaces multiples en un seul tiret", () => {
      expect(UtilsService.generateSlug("hello   world")).toBe("hello-world");
    });

    it("trim les espaces en début et fin", () => {
      expect(UtilsService.generateSlug("  hello world  ")).toBe("hello-world");
    });

    it("collapse les tirets consécutifs en un seul", () => {
      expect(UtilsService.generateSlug("hello--world")).toBe("hello-world");
    });
  });

  describe("caractères spéciaux et casse", () => {
    it("supprime les caractères spéciaux", () => {
      expect(UtilsService.generateSlug("hello!@#world")).toBe("helloworld");
    });

    it("conserve les chiffres", () => {
      expect(UtilsService.generateSlug("session 42")).toBe("session-42");
    });

    it("met tout en minuscule", () => {
      expect(UtilsService.generateSlug("Hello World")).toBe("hello-world");
    });
  });

  describe("cas d'usage réels", () => {
    it("génère un slug correct pour un nom de session typique", () => {
      expect(UtilsService.generateSlug("Étude du Talmud Bavli")).toBe("etude-du-talmud-bavli");
    });

    it("gère un nom avec plusieurs diacritiques combinés", () => {
      expect(UtilsService.generateSlug("Réservation Générale")).toBe("reservation-generale");
    });

    it("gère une chaîne sans diacritiques", () => {
      expect(UtilsService.generateSlug("Mishna Berachot")).toBe("mishna-berachot");
    });
  });
});
