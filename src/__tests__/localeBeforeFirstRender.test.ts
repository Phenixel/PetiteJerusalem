import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Hors français, les messages de la langue arrivent par un chunk. L'app
 * montait sans l'attendre : un visiteur anglais voyait d'abord l'accueil en
 * français, un visiteur hébreu du français écrit de droite à gauche, puis
 * toute la page se recomposait. Le premier rendu attend désormais la langue
 * (une seconde au plus).
 */

function setLanguages(languages: string[]) {
  Object.defineProperty(window.navigator, "languages", { value: languages, configurable: true });
  Object.defineProperty(window.navigator, "language", { value: languages[0], configurable: true });
}

describe("la langue au premier rendu", () => {
  afterEach(() => {
    setLanguages(["fr-FR"]);
    try {
      localStorage.clear();
    } catch {
      // localStorage indisponible : rien à nettoyer
    }
  });

  it("en hébreu, les messages sont là quand localeReady se résout", async () => {
    setLanguages(["he-IL"]);
    vi.resetModules();
    const { default: i18n, localeReady, waitsForLocale } = await import("../i18n");
    expect(waitsForLocale).toBe(true);
    await localeReady;
    expect(i18n.global.t("navbar.subtitle")).toBe("ללמוד ולשתף תורה, ביחד");
  });

  it("en français, rien n'attend", async () => {
    setLanguages(["fr-FR"]);
    vi.resetModules();
    const { waitsForLocale } = await import("../i18n");
    expect(waitsForLocale).toBe(false);
  });

  it("main.ts ne monte l'app qu'après localeReady hors français, une seconde au plus", () => {
    const main = readFileSync("src/main.ts", "utf8");
    expect(main).toMatch(/if \(waitsForLocale\) \{[\s\S]*?localeReady[\s\S]*?app\.mount\("#app"\)/);
    expect(main).toContain("LOCALE_WAIT_MS = 1_000");
  });
});
