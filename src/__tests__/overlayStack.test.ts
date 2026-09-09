import { beforeEach, describe, expect, it } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import {
  closeTopOverlay,
  hasOpenOverlay,
  pushOverlay,
  resetOverlayStack,
  useOverlay,
} from "../composables/useOverlayStack";

/**
 * La pile des surcouches : ce que le retour Android ferme avant de naviguer.
 * Une modale ouverte doit se fermer au premier retour, la page rester en
 * place ; deux surcouches se ferment dans l'ordre inverse de leur ouverture ;
 * et un composant qui suit une ref sort de la pile de lui-même.
 */
describe("pile des surcouches", () => {
  beforeEach(resetOverlayStack);

  it("ferme la surcouche du dessus, et dit s'il y en avait une", () => {
    expect(closeTopOverlay()).toBe(false);
    const closed: string[] = [];
    pushOverlay(() => closed.push("a"));
    pushOverlay(() => closed.push("b"));
    expect(hasOpenOverlay()).toBe(true);

    expect(closeTopOverlay()).toBe(true);
    expect(closed).toEqual(["b"]);
  });

  it("retire une surcouche par la fonction rendue, où qu'elle soit dans la pile", () => {
    const closed: string[] = [];
    const removeA = pushOverlay(() => closed.push("a"));
    // La fermeture retire elle-même la surcouche de la pile : c'est à elle de
    // le faire, la pile ne présume pas qu'une surcouche fermée a disparu
    // (l'introduction, par exemple, reste ouverte sur sa page précédente).
    const removeB = pushOverlay(() => {
      closed.push("b");
      removeB();
    });
    removeA();
    removeA(); // deux fois : sans effet
    expect(closeTopOverlay()).toBe(true);
    expect(closed).toEqual(["b"]);
    expect(hasOpenOverlay()).toBe(false);
  });

  it("suit une ref : inscrite à l'ouverture, retirée à la fermeture et au démontage", async () => {
    const open = ref(false);
    let closedBy = 0;
    const scope = effectScope();
    scope.run(() => {
      useOverlay(open, () => {
        closedBy++;
        open.value = false;
      });
    });
    expect(hasOpenOverlay()).toBe(false);

    open.value = true;
    await nextTick();
    expect(hasOpenOverlay()).toBe(true);

    // Le retour ferme par la fonction fournie, qui ramène la ref à faux.
    expect(closeTopOverlay()).toBe(true);
    expect(closedBy).toBe(1);
    await nextTick();
    expect(hasOpenOverlay()).toBe(false);

    open.value = true;
    await nextTick();
    expect(hasOpenOverlay()).toBe(true);
    scope.stop();
    expect(hasOpenOverlay()).toBe(false);
  });
});
