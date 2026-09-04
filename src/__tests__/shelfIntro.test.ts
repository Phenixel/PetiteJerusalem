import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * L'arrivée des livres sur les étagères : jolie une fois, pesante tous les
 * jours. Elle ne se rejoue que de mois en mois, et la décision vaut pour toute
 * la page (les deux étagères se garnissent ensemble, ou pas du tout).
 */

const STORAGE_KEY = "pj_shelf_intro_at";
const DAY = 24 * 60 * 60 * 1000;

/** Un lancement neuf : le module retranche sa décision. */
async function launch() {
  vi.resetModules();
  return (await import("../composables/useShelfIntro")).shouldPlayShelfIntro;
}

beforeEach(() => {
  localStorage.clear();
});

describe("shouldPlayShelfIntro", () => {
  it("se joue sur un appareil qui ne l'a jamais vue", async () => {
    const shouldPlay = await launch();
    expect(shouldPlay(1000)).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1000");
  });

  it("ne se rejoue pas dans le mois", async () => {
    (await launch())(0);
    const shouldPlay = await launch();
    expect(shouldPlay(20 * DAY)).toBe(false);
    // La date du passage ne bouge pas : c'est elle qui compte le mois.
    expect(localStorage.getItem(STORAGE_KEY)).toBe("0");
  });

  it("revient un mois plus tard", async () => {
    (await launch())(0);
    const shouldPlay = await launch();
    expect(shouldPlay(31 * DAY)).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(String(31 * DAY));
  });

  it("répond la même chose aux deux étagères d'une même page", async () => {
    const shouldPlay = await launch();
    expect(shouldPlay(0)).toBe(true);
    // La seconde étagère demande après la première : la réponse est tranchée
    // une fois, sinon une planche s'animerait sans l'autre.
    expect(shouldPlay(0)).toBe(true);
  });

  it("se joue quand le stockage est indisponible", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("stockage refusé");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("stockage refusé");
    });
    const shouldPlay = await launch();
    expect(shouldPlay(0)).toBe(true);
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
