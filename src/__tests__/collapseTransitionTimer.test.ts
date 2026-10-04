import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref, vShow, withDirectives } from "vue";
import CollapseTransition from "../components/CollapseTransition.vue";

/**
 * Le repli animé garde un minuteur de secours, au cas où `transitionend` ne
 * vient pas. Il appelait `window.clearTimeout` : parti après la page (un test
 * démonté, l'environnement jsdom retiré), il levait « window is not defined »,
 * et la CI échouait sur une erreur non gérée alors que tous les tests passaient.
 */
describe("le repli animé, après la page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("finit son minuteur de secours sans avoir besoin de window", async () => {
    vi.useFakeTimers();
    const open = ref(false);
    const host = document.createElement("div");
    const app = createApp({
      render: () =>
        h(CollapseTransition, null, {
          default: () => withDirectives(h("div", "contenu"), [[vShow, open.value]]),
        }),
    });
    app.mount(host);
    open.value = true;
    await nextTick();

    // La page s'en va avant le filet (350 ms) : plus de window.
    vi.stubGlobal("window", undefined);
    expect(() => vi.runAllTimers()).not.toThrow();
    app.unmount();
  });
});
