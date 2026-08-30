import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

/**
 * Défilement automatique des pages de texte.
 *
 * Ce qui doit tenir : un double appui sur le texte lance la descente et un
 * second l'arrête ; les boutons et les liens gardent leur double clic ; la
 * page descend bien à l'allure choisie et s'arrête d'elle-même à la fin du
 * texte ; le geste n'existe pas hors d'un texte ouvert (liste des chapitres,
 * composition de la lecture du jour) ; et quitter la page arrête tout.
 */

/** Géométrie de page simulée : jsdom ne fait rien défiler tout seul. */
let scrollTop = 0;
let pageHeight = 5000;
let frameCallback: FrameRequestCallback | null = null;
let now = 1_000_000;

function stubEnvironment() {
  scrollTop = 0;
  pageHeight = 5000;
  frameCallback = null;
  Object.defineProperty(window, "scrollY", { get: () => scrollTop, configurable: true });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    get: () => pageHeight,
    configurable: true,
  });
  window.innerHeight = 800;
  window.scrollTo = ((_x: number, y: number) => {
    scrollTop = y;
  }) as typeof window.scrollTo;
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    frameCallback = callback;
    return 1;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = (() => {
    frameCallback = null;
  }) as typeof window.cancelAnimationFrame;
}

/** Une image d'animation de plus, `ms` après la précédente. */
function frame(ms: number) {
  now += ms;
  const callback = frameCallback;
  frameCallback = null;
  callback?.(now);
}

/**
 * Une page de lecture. `reading` dit si un texte est ouvert : c'est ce que la
 * vraie page passe (section ouverte, mode lecture), et il peut changer sous
 * les pieds du lecteur.
 */
async function mountReadingPage(reading = ref(true)) {
  const { useAutoScroll } = await import("../composables/useAutoScroll");
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({
    setup() {
      useAutoScroll(reading);
      return () => h("main", [h("p", "un verset"), h("button", "un bouton")]);
    },
  });
  app.mount(host);
  return { app, host, reading };
}

function doubleClick(target: Element | Document = document) {
  target.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
}

describe("défilement automatique", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    document.body.innerHTML = "";
    stubEnvironment();
    vi.spyOn(Date, "now").mockImplementation(() => now);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("part au double clic sur le texte, et s'arrête au suivant", async () => {
    const { isAutoScrolling } = await import("../composables/useAutoScroll");
    const { host } = await mountReadingPage();

    doubleClick(host.querySelector("p")!);
    expect(isAutoScrolling.value).toBe(true);

    // Le geste suivant compte comme un geste, pas comme la fin du premier.
    now += 1000;
    doubleClick(host.querySelector("p")!);
    expect(isAutoScrolling.value).toBe(false);
  });

  it("laisse leur double clic aux boutons et aux liens", async () => {
    const { isAutoScrolling } = await import("../composables/useAutoScroll");
    const { host } = await mountReadingPage();

    doubleClick(host.querySelector("button")!);
    expect(isAutoScrolling.value).toBe(false);
  });

  it("descend à l'allure choisie, et s'arrête à la fin du texte", async () => {
    const { isAutoScrolling, setAutoScrollSpeed, AUTO_SCROLL_SPEEDS } = await import(
      "../composables/useAutoScroll"
    );
    const { host } = await mountReadingPage();
    setAutoScrollSpeed("medium");
    const perSecond = AUTO_SCROLL_SPEEDS.find((speed) => speed.id === "medium")!.pixelsPerSecond;

    doubleClick(host.querySelector("p")!);
    frame(16); // Première image : elle ne fait que poser le repère de temps.
    expect(scrollTop).toBe(0);

    frame(1000);
    expect(scrollTop).toBeCloseTo(perSecond, 5);

    // Fin du texte : la page s'arrête là, et la pastille disparaît avec elle.
    pageHeight = 800 + scrollTop + 10;
    frame(1000);
    expect(scrollTop).toBe(pageHeight - 800);
    expect(isAutoScrolling.value).toBe(false);
  });

  it("ne démarre pas quand il n'y a rien à faire défiler", async () => {
    const { isAutoScrolling } = await import("../composables/useAutoScroll");
    pageHeight = 700; // Plus courte que la fenêtre.
    const { host } = await mountReadingPage();

    doubleClick(host.querySelector("p")!);
    expect(isAutoScrolling.value).toBe(false);
  });

  it("garde l'allure sur l'appareil, et ignore une valeur inconnue", async () => {
    const module = await import("../composables/useAutoScroll");
    module.setAutoScrollSpeed("fast");
    expect(module.autoScrollSpeedId.value).toBe("fast");

    // @ts-expect-error valeur volontairement hors des trois allures
    module.setAutoScrollSpeed("turbo");
    expect(module.autoScrollSpeedId.value).toBe("fast");

    // Lancement suivant : l'allure retenue est celle du dernier choix.
    vi.resetModules();
    const relaunched = await import("../composables/useAutoScroll");
    expect(relaunched.autoScrollSpeedId.value).toBe("fast");
  });

  it("ne s'offre pas hors d'un texte ouvert, et s'arrête si on en sort", async () => {
    const { isAutoScrolling } = await import("../composables/useAutoScroll");
    const reading = ref(false);
    const { host } = await mountReadingPage(reading);

    // Liste des chapitres, composition de la lecture du jour : rien ne part.
    doubleClick(host.querySelector("p")!);
    expect(isAutoScrolling.value).toBe(false);

    // Le texte s'ouvre : le geste vaut de nouveau.
    reading.value = true;
    await nextTick();
    doubleClick(host.querySelector("p")!);
    expect(isAutoScrolling.value).toBe(true);

    // Retour à la liste : la descente s'arrête d'elle-même.
    reading.value = false;
    await nextTick();
    expect(isAutoScrolling.value).toBe(false);
  });

  it("s'arrête quand on quitte la page de lecture", async () => {
    const { isAutoScrolling } = await import("../composables/useAutoScroll");
    const { app, host } = await mountReadingPage();

    doubleClick(host.querySelector("p")!);
    expect(isAutoScrolling.value).toBe(true);

    app.unmount();
    expect(isAutoScrolling.value).toBe(false);
  });
});
