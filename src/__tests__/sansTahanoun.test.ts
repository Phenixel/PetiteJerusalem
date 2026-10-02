import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn() },
}));

/**
 * « Sans tahanoun » ne vaut qu'un jour : une simhá est une affaire d'un
 * jour, et un interrupteur resté allumé retirerait le tahanoun des semaines
 * durant sans qu'on le voie.
 */
describe("sans tahanoun", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 14, 9, 0));
  });

  afterEach(() => vi.useRealTimers());

  it("s'allume pour la journée, et s'éteint de lui-même au lendemain", async () => {
    const { isSansTahanoun, sansTahanoun, setSansTahanoun } = await import(
      "../composables/useSansTahanoun"
    );
    expect(sansTahanoun.value).toBe(false);

    setSansTahanoun(true);
    expect(isSansTahanoun()).toBe(true);
    // Le soir même, toujours là.
    expect(isSansTahanoun(new Date(2026, 8, 14, 23, 30))).toBe(true);
    // Le lendemain, non : la page recalcule ses occasions avec l'heure du rendu.
    expect(isSansTahanoun(new Date(2026, 8, 15, 8, 0))).toBe(false);

    setSansTahanoun(false);
    expect(isSansTahanoun()).toBe(false);
  });

  it("l'interrupteur s'éteint au lendemain, l'app restée ouverte, et se rallume", async () => {
    // En natif, la page vit des jours en arrière-plan : l'état gardé de la
    // veille laissait l'interrupteur allumé, et chaque appui (« éteindre »)
    // était ignoré puisqu'il l'était déjà.
    const { isSansTahanoun, sansTahanoun, setSansTahanoun } = await import(
      "../composables/useSansTahanoun"
    );
    setSansTahanoun(true);
    expect(sansTahanoun.value).toBe(true);

    vi.setSystemTime(new Date(2026, 8, 15, 7, 0));
    expect(sansTahanoun.value).toBe(false);

    // Une brit mila ce mardi : l'appui l'allume pour ce jour-là.
    setSansTahanoun(true);
    expect(isSansTahanoun()).toBe(true);
    expect(sansTahanoun.value).toBe(true);
  });

  it("survit au rechargement de la page le jour même, pas après", async () => {
    let mod = await import("../composables/useSansTahanoun");
    mod.setSansTahanoun(true);

    vi.resetModules();
    mod = await import("../composables/useSansTahanoun");
    expect(mod.isSansTahanoun()).toBe(true);

    vi.setSystemTime(new Date(2026, 8, 15, 9, 0));
    vi.resetModules();
    mod = await import("../composables/useSansTahanoun");
    expect(mod.isSansTahanoun()).toBe(false);
  });
});
