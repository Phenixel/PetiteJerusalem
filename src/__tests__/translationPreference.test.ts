import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le réglage « Traduction » (composables/useTranslation) : éteint au départ,
 * gardé sur l'appareil, et la langue d'un texte choisie dans l'ordre que dit
 * docs/traductions.md (le choix fait, la langue de l'interface, puis ce qui
 * existe).
 */

vi.mock("../services/analyticsService", () => ({ analyticsService: { capture: vi.fn() } }));

describe("réglage de la traduction", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("choisit la langue : le choix fait, puis l'interface, puis ce qui existe", async () => {
    const { pickTranslationLang } = await import("../composables/useTranslation");
    expect(pickTranslationLang(["en", "fr"], "fr", null)).toBe("fr");
    expect(pickTranslationLang(["en", "fr"], "fr", "en")).toBe("en");
    // Le Talmud, qu'on n'a qu'en anglais : un francophone le lit en anglais.
    expect(pickTranslationLang(["en"], "fr", null)).toBe("en");
    expect(pickTranslationLang(["en"], "fr", "fr")).toBe("en");
    // L'interface en hébreu : l'anglais d'abord.
    expect(pickTranslationLang(["en", "fr"], "he", null)).toBe("en");
    expect(pickTranslationLang([], "fr", "fr")).toBeNull();
  });

  it("est éteint au départ, et se souvient de ce qu'on a choisi", async () => {
    const first = await import("../composables/useTranslation");
    expect(first.translationShown.value).toBe(false);
    expect(first.translationLangChoice.value).toBeNull();
    first.setTranslationShown(true, "fr");
    first.setTranslationLang("en");
    first.setTranslationLang("de"); // inconnue : ignorée

    vi.resetModules();
    const again = await import("../composables/useTranslation");
    expect(again.translationShown.value).toBe(true);
    expect(again.translationLangChoice.value).toBe("en");
  });
});
