import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

/**
 * L'écran allumé pendant la lecture.
 *
 * Ce qui doit tenir : un texte ouvert prend le verrou d'écran et le rend en
 * quittant la page ; il n'est pas pris hors d'un texte ouvert (liste des
 * chapitres, composition de la lecture du jour) ; le passage d'une page de
 * lecture à l'autre ne le lâche pas ; le verrou rendu par le système quand
 * l'app passe en arrière-plan est repris au retour à l'écran ; et un
 * navigateur sans la Screen Wake Lock API ne fait rien planter.
 */

interface FakeSentinel {
  released: boolean;
  release: () => Promise<void>;
  dispatchRelease: () => void;
  addEventListener: (type: string, listener: () => void) => void;
}

let requests: FakeSentinel[] = [];
let requestCount = 0;
/** Ce que répond l'appareil : refus possible (onglet caché, batterie faible). */
let refuse = false;
let visibility: DocumentVisibilityState = "visible";

function stubWakeLock() {
  requests = [];
  requestCount = 0;
  refuse = false;
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    get: () => visibility,
    configurable: true,
  });
  Object.defineProperty(navigator, "wakeLock", {
    value: {
      request: () => {
        requestCount += 1;
        if (refuse) return Promise.reject(new Error("refusé"));
        const listeners: (() => void)[] = [];
        const sentinel: FakeSentinel = {
          released: false,
          release: () => {
            sentinel.released = true;
            return Promise.resolve();
          },
          dispatchRelease: () => {
            sentinel.released = true;
            listeners.forEach((listener) => listener());
          },
          addEventListener: (type, listener) => {
            if (type === "release") listeners.push(listener);
          },
        };
        requests.push(sentinel);
        return Promise.resolve(sentinel);
      },
    },
    configurable: true,
  });
}

/** Le dernier verrou obtenu, s'il y en a un. */
function lastLock(): FakeSentinel | undefined {
  return requests[requests.length - 1];
}

/**
 * Une page de lecture. `reading` dit si un texte est ouvert : c'est ce que la
 * vraie page passe (section ouverte, mode lecture), et il peut changer sous
 * les pieds du lecteur.
 */
async function mountReadingPage(reading = ref(true)) {
  const { useKeepAwake } = await import("../composables/useKeepAwake");
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({
    setup() {
      useKeepAwake(reading);
      return () => h("main", "un verset");
    },
  });
  app.mount(host);
  // La demande de verrou est asynchrone : on la laisse aboutir.
  await nextTick();
  await Promise.resolve();
  await Promise.resolve();
  return { app, host, reading };
}

describe("écran allumé pendant la lecture", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = "";
    stubWakeLock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("garde l'écran allumé sur un texte ouvert, et le rend en quittant", async () => {
    const { app } = await mountReadingPage();
    expect(requestCount).toBe(1);
    expect(lastLock()?.released).toBe(false);

    app.unmount();
    await Promise.resolve();
    expect(lastLock()?.released).toBe(true);
  });

  it("ne demande rien hors d'un texte ouvert, et suit l'ouverture", async () => {
    const reading = ref(false);
    await mountReadingPage(reading);
    expect(requestCount).toBe(0);

    reading.value = true;
    await nextTick();
    await Promise.resolve();
    expect(requestCount).toBe(1);

    // Retour à la liste des chapitres : l'écran reprend son cours.
    reading.value = false;
    await nextTick();
    expect(lastLock()?.released).toBe(true);
  });

  it("ne lâche pas le verrou quand une page de lecture remplace l'autre", async () => {
    const first = await mountReadingPage();
    // La page suivante se monte avant que la précédente ne se démonte.
    const second = await mountReadingPage();
    first.app.unmount();
    await Promise.resolve();

    expect(requestCount).toBe(1);
    expect(lastLock()?.released).toBe(false);

    second.app.unmount();
    await Promise.resolve();
    expect(lastLock()?.released).toBe(true);
  });

  it("reprend le verrou rendu par le système au retour à l'écran", async () => {
    await mountReadingPage();
    expect(requestCount).toBe(1);

    // L'app passe en arrière-plan : l'appareil reprend le verrou de lui-même.
    visibility = "hidden";
    lastLock()!.dispatchRelease();
    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();
    expect(requestCount).toBe(1);

    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();
    await Promise.resolve();
    expect(requestCount).toBe(2);
    expect(lastLock()?.released).toBe(false);
  });

  it("laisse la lecture tranquille quand l'appareil refuse", async () => {
    refuse = true;
    const { app } = await mountReadingPage();
    expect(requestCount).toBe(1);
    expect(requests).toEqual([]);
    app.unmount();
  });

  it("ne fait rien sur un navigateur sans verrou d'écran", async () => {
    Reflect.deleteProperty(navigator, "wakeLock");
    const { app } = await mountReadingPage();
    expect(requestCount).toBe(0);
    app.unmount();
  });
});
