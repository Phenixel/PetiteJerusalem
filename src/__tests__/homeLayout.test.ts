import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * L'accueil à son goût (composables/useHomeLayout.ts) : le paquet du jour
 * reste en tête, hors de la liste ; les blocs se déplacent, se masquent, se
 * remettent ; l'appareil s'en souvient, et une liste d'une autre version se
 * remet d'aplomb (un bloc inconnu se tait, un bloc nouveau prend sa place).
 */

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

describe("l'accueil à son goût", () => {
  it("part de l'accueil d'origine, Reprendre à remettre", async () => {
    const { useHomeLayout } = await import("../composables/useHomeLayout");
    const { layout } = useHomeLayout();
    expect(layout.value.order).toEqual(["horaires", "volumes", "portes", "dates"]);
    expect(layout.value.hidden).toEqual(["reprendre"]);
  });

  it("déplace, masque, remet, et l'appareil s'en souvient", async () => {
    const { useHomeLayout } = await import("../composables/useHomeLayout");
    const home = useHomeLayout();
    home.move("volumes", 0);
    home.hide("portes");
    home.show("reprendre");
    expect(home.layout.value.order).toEqual(["volumes", "horaires", "dates", "reprendre"]);
    expect(home.layout.value.hidden).toEqual(["portes"]);
    vi.resetModules();
    const again = (await import("../composables/useHomeLayout")).useHomeLayout();
    expect(again.layout.value.order).toEqual(["volumes", "horaires", "dates", "reprendre"]);
  });

  it("remet d'aplomb ce qu'une autre version a gardé", async () => {
    const { normalizeLayout } = await import("../composables/useHomeLayout");
    const layout = normalizeLayout({
      order: ["portes", "inconnu" as never, "portes"],
      hidden: ["dates"],
    });
    expect(layout.order).toEqual(["portes", "horaires", "volumes"]);
    expect(layout.hidden).toEqual(["dates", "reprendre"]);
  });
});
