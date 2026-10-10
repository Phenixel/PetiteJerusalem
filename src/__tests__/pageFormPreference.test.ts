import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le choix de la forme de la page (usePageForm) : gardé sur l'appareil, il
 * rouvre la guemara et la Torah dans la forme où on les a quittées.
 */

vi.mock("../composables/useNativeApp", () => ({ isNativeApp: false, appPlatform: "web" }));

describe("forme de la page, préférence d'appareil", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("part du texte verset par verset quand rien n'a été choisi", async () => {
    const { usePageForm } = await import("../composables/usePageForm");
    expect(usePageForm().enabled.value).toBe(false);
  });

  it("garde le choix pour la prochaine ouverture", async () => {
    const first = await import("../composables/usePageForm");
    first.usePageForm().set(true);
    expect(localStorage.getItem("pj-page-form")).toBe("1");

    vi.resetModules();
    const second = await import("../composables/usePageForm");
    expect(second.usePageForm().enabled.value).toBe(true);
  });
});
