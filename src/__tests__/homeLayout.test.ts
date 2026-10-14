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

  it("pendant le glissé, montre où le bloc sera posé et écarte les autres", async () => {
    const { dropIndex, makeRoom } = await import("../composables/useHomeLayout");
    // Un pas de 96 : la place change à mi-chemin d'un bloc, et ne sort pas de la liste.
    expect(dropIndex(1, 40, 96, 4)).toBe(1);
    expect(dropIndex(1, 50, 96, 4)).toBe(2);
    expect(dropIndex(1, -200, 96, 4)).toBe(0);
    expect(dropIndex(1, 900, 96, 4)).toBe(3);
    // Descendu de la place 1 à la 3 : les blocs 2 et 3 remontent d'un cran.
    expect([0, 1, 2, 3].map((i) => makeRoom(i, 1, 3))).toEqual([0, 0, -1, -1]);
    // Remonté de la place 3 à la 0 : les blocs 0 à 2 descendent d'un cran.
    expect([0, 1, 2, 3].map((i) => makeRoom(i, 3, 0))).toEqual([1, 1, 1, 0]);
    // Sur place : personne ne bouge.
    expect([0, 1, 2, 3].map((i) => makeRoom(i, 2, 2))).toEqual([0, 0, 0, 0]);
  });
});
