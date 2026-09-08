import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, type App } from "vue";
import { useScrollFrame } from "../composables/useScrollFrame";

/**
 * La mesure partagée du défilement : un seul écouteur pour toute l'app, posé
 * quand le premier composant lit la mesure et retiré avec le dernier, et une
 * seule lecture de la hauteur du document par image.
 */

let scrollTop = 0;
let pageHeight = 3000;
let frameCallback: FrameRequestCallback | null = null;

function stubEnvironment() {
  scrollTop = 0;
  pageHeight = 3000;
  frameCallback = null;
  Object.defineProperty(window, "scrollY", { get: () => scrollTop, configurable: true });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    get: () => pageHeight,
    configurable: true,
  });
  window.innerHeight = 1000;
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    frameCallback = callback;
    return 1;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = (() => {
    frameCallback = null;
  }) as typeof window.cancelAnimationFrame;
}

/** Joue l'image en attente, s'il y en a une. */
function runFrame() {
  const callback = frameCallback;
  frameCallback = null;
  callback?.(performance.now());
}

const Consumer = defineComponent({
  setup() {
    const frame = useScrollFrame();
    return () =>
      h("div", {
        "data-progress": frame.value.progress,
        "data-bottom": String(frame.value.atBottom),
      });
  },
});

const apps: App[] = [];
function mountConsumer() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp(Consumer);
  app.mount(host);
  apps.push(app);
  return { app, host };
}

function scrollListeners(spy: ReturnType<typeof vi.spyOn>, type: string) {
  return spy.mock.calls.filter(([event]) => event === type).length;
}

describe("useScrollFrame", () => {
  beforeEach(() => {
    stubEnvironment();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    while (apps.length) apps.pop()?.unmount();
    vi.restoreAllMocks();
  });

  it("ne pose qu'un écouteur de défilement, quel que soit le nombre de lecteurs", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");

    const first = mountConsumer();
    const second = mountConsumer();
    expect(scrollListeners(add, "scroll")).toBe(1);
    expect(scrollListeners(add, "resize")).toBe(1);

    // Le premier lecteur s'en va : l'écouteur reste pour le second.
    first.app.unmount();
    apps.splice(apps.indexOf(first.app), 1);
    expect(scrollListeners(remove, "scroll")).toBe(0);

    // Le dernier s'en va : l'écouteur est retiré.
    second.app.unmount();
    apps.splice(apps.indexOf(second.app), 1);
    expect(scrollListeners(remove, "scroll")).toBe(1);
    expect(scrollListeners(remove, "resize")).toBe(1);
  });

  it("mesure une fois par image : plusieurs événements, une seule lecture", async () => {
    const { host } = mountConsumer();
    runFrame();
    await nextTick();
    expect(host.querySelector("div")?.getAttribute("data-progress")).toBe("0");

    let reads = 0;
    Object.defineProperty(document.documentElement, "scrollHeight", {
      get: () => {
        reads += 1;
        return pageHeight;
      },
      configurable: true,
    });

    scrollTop = 500;
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("scroll"));
    // Rien n'est lu dans le gestionnaire : tout attend l'image.
    expect(reads).toBe(0);
    runFrame();
    expect(reads).toBe(1);
    await nextTick();
    // 500 / (3000 - 1000) = 0,25
    expect(host.querySelector("div")?.getAttribute("data-progress")).toBe("0.25");
  });

  it("dit quand la page est tout en bas", async () => {
    const { host } = mountConsumer();
    scrollTop = 2000;
    window.dispatchEvent(new Event("scroll"));
    runFrame();
    await nextTick();
    expect(host.querySelector("div")?.getAttribute("data-progress")).toBe("1");
    expect(host.querySelector("div")?.getAttribute("data-bottom")).toBe("true");
  });
});
