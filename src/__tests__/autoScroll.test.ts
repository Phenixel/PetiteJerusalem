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
 *
 * Et surtout, depuis le défilement frénétique remonté sur iPhone : la page
 * appartient au lecteur dès qu'il la touche, et le script n'y pose plus rien
 * tant qu'elle est à lui (voir useAutoScroll, « la main du lecteur »).
 */

/** Géométrie de page simulée : jsdom ne fait rien défiler tout seul. */
let scrollTop = 0;
let scrollLeft = 0;
let pageHeight = 5000;
let frameCallback: FrameRequestCallback | null = null;
let now = 1_000_000;

function stubEnvironment() {
  scrollTop = 0;
  scrollLeft = 0;
  pageHeight = 5000;
  frameCallback = null;
  Object.defineProperty(window, "scrollY", { get: () => scrollTop, configurable: true });
  Object.defineProperty(window, "scrollX", { get: () => scrollLeft, configurable: true });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    get: () => pageHeight,
    configurable: true,
  });
  window.innerHeight = 800;
  window.scrollTo = ((x: number, y: number) => {
    scrollLeft = x;
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

/** Plusieurs images de suite, à la cadence d'un écran ordinaire. */
function frames(count: number, ms = 16) {
  for (let i = 0; i < count; i++) frame(ms);
}

/**
 * Un événement tactile. Les écouteurs du défilement n'en lisent que le nombre
 * de doigts restants, ce que jsdom ne sait pas fabriquer lui-même.
 */
function touch(type: "touchstart" | "touchmove" | "touchend", remaining: number) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, "touches", { value: { length: remaining } });
  window.dispatchEvent(event);
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

    // Une seconde de lecture, image par image : la distance parcourue est
    // celle de l'allure choisie. Elle se compte image par image et non d'un
    // saut de mille millisecondes, qui serait une image perdue (voir plus bas).
    frames(60);
    expect(scrollTop).toBeCloseTo((perSecond * 60 * 16) / 1000, 5);

    // Fin du texte : le défilement s'arrête là, et la pastille disparaît avec elle.
    // La limite n'est plus lue à chaque image mais quand la page change de
    // taille (`resize`, et le ResizeObserver du corps dans un vrai navigateur).
    pageHeight = 800 + scrollTop + 10;
    window.dispatchEvent(new Event("resize"));
    frames(60);
    expect(scrollTop).toBe(pageHeight - 800);
    expect(isAutoScrolling.value).toBe(false);
  });

  /**
   * Le conflit avec le défileur du système, cause du défilement frénétique
   * remonté sur iPhone : tant que le lecteur a la page en main, rien n'est
   * posé par-dessus, et la descente repart de là où il l'a laissée.
   */
  describe("quand le lecteur fait défiler lui-même", () => {
    it("ne pose plus rien tant qu'un doigt touche l'écran", async () => {
      const { host } = await mountReadingPage();

      doubleClick(host.querySelector("p")!);
      frames(2);
      const before = scrollTop;

      touch("touchstart", 1);
      frames(30);
      expect(scrollTop).toBe(before);
    });

    it("repart d'où le lecteur a laissé la page, sans la ramener", async () => {
      const { AUTO_SCROLL_SPEEDS, autoScrollSpeedId } = await import(
        "../composables/useAutoScroll"
      );
      const { host } = await mountReadingPage();
      const perSecond = AUTO_SCROLL_SPEEDS.find(
        (speed) => speed.id === autoScrollSpeedId.value,
      )!.pixelsPerSecond;

      doubleClick(host.querySelector("p")!);
      frames(10);

      // Un glissement vers le bas : c'est le système qui déplace la page.
      touch("touchstart", 1);
      touch("touchmove", 1);
      scrollTop = 1200;
      touch("touchend", 0);

      // Le doigt est parti mais l'élan court encore : rien ne vient par-dessus.
      scrollTop = 1260;
      frames(6);
      expect(scrollTop).toBe(1260);

      // Il retombe, la page est immobile : la descente reprend de là, à son
      // allure, et surtout pas de la position qu'elle avait avant le geste.
      frames(20);
      const resumed = scrollTop;
      expect(resumed).toBeGreaterThan(1260);
      frames(60);
      expect(scrollTop - resumed).toBeCloseTo((perSecond * 60 * 16) / 1000, 5);
    });

    it("s'efface aussi devant la molette", async () => {
      const { host } = await mountReadingPage();

      doubleClick(host.querySelector("p")!);
      frames(2);

      window.dispatchEvent(new Event("wheel"));
      scrollTop = 900;
      frames(10); // Sous le délai d'une salve de molette.
      expect(scrollTop).toBe(900);
    });

    it("laisse l'axe horizontal où il est", async () => {
      const { host } = await mountReadingPage();
      // Page en hébreu, ou zoomée au pincement : l'abscisse n'est pas à zéro.
      scrollLeft = 40;

      doubleClick(host.querySelector("p")!);
      frames(30);
      expect(scrollLeft).toBe(40);
      expect(scrollTop).toBeGreaterThan(0);
    });

    it("ne rattrape pas une image perdue d'un bond", async () => {
      const { setAutoScrollSpeed, AUTO_SCROLL_SPEEDS } = await import(
        "../composables/useAutoScroll"
      );
      const { host } = await mountReadingPage();
      setAutoScrollSpeed("fast");
      const perSecond = AUTO_SCROLL_SPEEDS.find((speed) => speed.id === "fast")!.pixelsPerSecond;

      doubleClick(host.querySelector("p")!);
      frame(16);

      // Une seconde sans image (mise en page longue, app revenue au premier
      // plan) : la page avance de ce qu'une image vaut, pas d'une seconde.
      frame(1000);
      expect(scrollTop).toBeCloseTo((perSecond * 50) / 1000, 5);
    });
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

  /**
   * L'interrupteur des réglages : deux appuis rapprochés arrivent sans qu'on
   * l'ait voulu, et qui l'a coupé ne doit plus rien voir descendre.
   */
  describe("coupé dans les réglages", () => {
    it("est proposé tant que personne ne l'a coupé", async () => {
      const { autoScrollEnabled } = await import("../composables/useAutoScroll");

      expect(autoScrollEnabled.value).toBe(true);
    });

    it("ne répond plus au double appui", async () => {
      const { isAutoScrolling, setAutoScrollEnabled } = await import(
        "../composables/useAutoScroll"
      );
      const { host } = await mountReadingPage();
      setAutoScrollEnabled(false);

      doubleClick(host.querySelector("p")!);
      expect(isAutoScrolling.value).toBe(false);

      // Rallumé, le geste revaut : couper n'est pas une porte à sens unique.
      now += 1000;
      setAutoScrollEnabled(true);
      doubleClick(host.querySelector("p")!);
      expect(isAutoScrolling.value).toBe(true);
    });

    it("arrête sur-le-champ ce qui descend", async () => {
      const { isAutoScrolling, setAutoScrollEnabled } = await import(
        "../composables/useAutoScroll"
      );
      const { host } = await mountReadingPage();

      doubleClick(host.querySelector("p")!);
      expect(isAutoScrolling.value).toBe(true);

      setAutoScrollEnabled(false);
      expect(isAutoScrolling.value).toBe(false);
    });

    it("le reste au lancement suivant", async () => {
      const module = await import("../composables/useAutoScroll");
      module.setAutoScrollEnabled(false);

      vi.resetModules();
      const relaunched = await import("../composables/useAutoScroll");
      expect(relaunched.autoScrollEnabled.value).toBe(false);
    });
  });
});
