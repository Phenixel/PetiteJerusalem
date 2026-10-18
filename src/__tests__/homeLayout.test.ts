import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * L'accueil à son goût (composables/useHomeLayout.ts) : le paquet du jour
 * reste en tête, hors de la liste ; les blocs se déplacent, se masquent, se
 * remettent ; l'appareil s'en souvient, et une liste d'une autre version se
 * remet d'aplomb (un bloc inconnu se tait, un bloc nouveau prend sa place).
 * Pendant le glissé, la place où le bloc sera posé suit le doigt, et les
 * autres blocs s'écartent pour la laisser voir.
 */

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

describe("l'accueil à son goût", () => {
  it("part de l'accueil d'origine, Reprendre, les livres épinglés et l'écoute à remettre", async () => {
    const { useHomeLayout } = await import("../composables/useHomeLayout");
    const { layout } = useHomeLayout();
    expect(layout.value.order).toEqual(["horaires", "volumes", "portes", "dates"]);
    expect(layout.value.hidden).toEqual(["reprendre", "livres", "ecoute"]);
  });

  it("déplace, masque, remet, et l'appareil s'en souvient", async () => {
    const { useHomeLayout } = await import("../composables/useHomeLayout");
    const home = useHomeLayout();
    home.move("volumes", 0);
    home.hide("portes");
    home.show("reprendre");
    expect(home.layout.value.order).toEqual(["volumes", "horaires", "dates", "reprendre"]);
    expect(home.layout.value.hidden).toEqual(["livres", "ecoute", "portes"]);
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
    expect(layout.hidden).toEqual(["dates", "reprendre", "livres", "ecoute"]);
  });

  it("while dragging, a block takes a tile's place past its middle, and only then", async () => {
    const { pickSlot } = await import("../composables/useHomeLayout");
    // Three full-width tiles stacked, 100 high with a gap of 20.
    const column = [0, 120, 240].map((top) => ({
      left: 0,
      top,
      width: 300,
      height: 100,
      wide: true,
    }));
    // Held at 0, over the top half of tile 1: it stays; past its middle: it takes 1.
    expect(pickSlot(150, 160, 0, column)).toBe(0);
    expect(pickSlot(150, 180, 0, column)).toBe(1);
    // Held at 2, moving up: it takes 1 above its middle only.
    expect(pickSlot(150, 180, 2, column)).toBe(2);
    expect(pickSlot(150, 160, 2, column)).toBe(1);
    // Between two tiles, or outside them: it stays.
    expect(pickSlot(150, 110, 0, column)).toBe(0);
    expect(pickSlot(400, 180, 0, column)).toBe(0);

    // Two half tiles side by side: along the row, mirrored in Hebrew.
    const row = [0, 160].map((left) => ({ left, top: 0, width: 140, height: 100, wide: false }));
    expect(pickSlot(200, 50, 0, row)).toBe(0);
    expect(pickSlot(250, 50, 0, row)).toBe(1);
    expect(pickSlot(200, 50, 0, row, true)).toBe(1);
  });
});
