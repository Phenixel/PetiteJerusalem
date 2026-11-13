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
/** How many times the script set a position: none while the reader holds the page. */
let writes = 0;

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
  writes = 0;
  window.scrollTo = ((x: number, y: number) => {
    writes++;
    scrollLeft = x;
    scrollTop = y;
  }) as typeof window.scrollTo;
  // Like a browser: whole pixels, and never past the ends of the page.
  window.scrollBy = ((options: ScrollToOptions) => {
    writes++;
    const max = Math.max(0, pageHeight - window.innerHeight);
    scrollTop = Math.min(max, Math.max(0, scrollTop + Math.trunc(options.top ?? 0)));
  }) as typeof window.scrollBy;
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    frameCallback = callback;
    return 1;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = (() => {
    frameCallback = null;
  }) as typeof window.cancelAnimationFrame;
}

/**
 * The distance travelled matches the pace, to the pixel: a page only moves by
 * whole pixels, and the fraction left waits for the next frame.
 */
function expectTravelled(actual: number, expected: number) {
  expect(actual).toBeGreaterThan(expected - 1);
  expect(actual).toBeLessThanOrEqual(expected + 1e-9);
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
 * A finger on the text, as the browser reports it: where it is, and how many
 * fingers remain. Dispatched on the text, so that it goes through the
 * document like a real touch.
 */
function finger(
  type: "touchstart" | "touchmove" | "touchend",
  target: Element,
  x: number,
  y: number,
) {
  const event = new Event(type, { bubbles: true });
  const point = { clientX: x, clientY: y };
  Object.defineProperty(event, "touches", { value: type === "touchend" ? [] : [point] });
  Object.defineProperty(event, "changedTouches", { value: [point] });
  target.dispatchEvent(event);
}

/** A tap: the finger lands and leaves without moving. */
function tap(target: Element, x = 100, y = 300, ms = 60) {
  finger("touchstart", target, x, y);
  now += ms;
  finger("touchend", target, x, y);
}

/** A quick swipe up, the way one scrolls a text: short, but a real move. */
function swipe(target: Element, x = 100, from = 500, to = 440, ms = 60) {
  finger("touchstart", target, x, from);
  now += ms / 2;
  finger("touchmove", target, x, (from + to) / 2);
  now += ms / 2;
  finger("touchmove", target, x, to);
  finger("touchend", target, x, to);
}

/** The page reports a scroll, as the browser does on each frame it moves. */
function pageScrolled() {
  window.dispatchEvent(new Event("scroll"));
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

  it("leaves the progress bar its own double tap: two slides in a row", async () => {
    const { isAutoScrolling } = await import("../composables/useAutoScroll");
    const { host } = await mountReadingPage();
    const bar = document.createElement("div");
    bar.dataset.ownGestures = "";
    host.appendChild(bar);

    doubleClick(bar);
    expect(isAutoScrolling.value).toBe(false);
  });

  it("ne part pas sous une fenêtre ouverte : le double appui est à la fenêtre", async () => {
    const { isAutoScrolling } = await import("../composables/useAutoScroll");
    const { useOverlay } = await import("../composables/useOverlayStack");
    const { effectScope } = await import("vue");
    const { host } = await mountReadingPage();
    // A parchment's photo open over the text: a double tap zooms into it.
    const scope = effectScope();
    scope.run(() => useOverlay(ref(true), () => {}));

    doubleClick(host.querySelector("p")!);
    expect(isAutoScrolling.value).toBe(false);
    scope.stop();
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
    expectTravelled(scrollTop, (perSecond * 60 * 16) / 1000);

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
      expectTravelled(scrollTop - resumed, (perSecond * 60 * 16) / 1000);
    });

    /**
     * A fast swipe on iOS coasts for close to three seconds, and the
     * auto-scroll used to take the page back after two at most: the fight
     * with the system's scroller started again, only on fast swipes. The
     * end of the momentum is now read from the scroll events.
     */
    it("waits for the end of a long momentum, however long it lasts", async () => {
      const { host } = await mountReadingPage();

      doubleClick(host.querySelector("p")!);
      frames(10);

      touch("touchstart", 1);
      touch("touchmove", 1);
      scrollTop = 1200;
      touch("touchend", 0);
      const before = writes;

      // Three seconds of momentum, slowing down. `scrollY` is only updated
      // every third frame, as when it lags behind the system's scroller:
      // two frames in a row then read the same position while the page
      // moves on.
      let speed = 3; // px per ms
      for (let elapsed = 0; elapsed < 3000; elapsed += 16) {
        if ((elapsed / 16) % 3 === 0) {
          scrollTop += speed * 48;
          pageScrolled();
        }
        speed *= 0.998 ** 16;
        frame(16);
      }
      expect(writes).toBe(before);

      // The page is at rest: the scrolling resumes from where it stopped.
      const rest = scrollTop;
      frames(30);
      expect(writes).toBeGreaterThan(before);
      expect(scrollTop).toBeGreaterThan(rest);
    });

    /**
     * On iPhone, a script's position is applied without stopping what the
     * system is doing with the page, and it was computed from a `scrollY`
     * that lags behind. Setting positions brought the page back each frame,
     * then iOS pushed it on again. The page is now moved by steps, which
     * WebKit adds to where the page really is.
     */
    it("moves the page by steps, and never pulls it back", async () => {
      const { host } = await mountReadingPage();
      const setPosition = vi.spyOn(window, "scrollTo");

      doubleClick(host.querySelector("p")!);
      frames(30);

      // The system moves the page a few pixels further than we did (the
      // tail of a momentum, a lagging read): the next steps start from there.
      for (let i = 0; i < 20; i++) {
        const moved = scrollTop + 3;
        scrollTop = moved;
        frame(16);
        expect(scrollTop).toBeGreaterThanOrEqual(moved);
      }
      expect(setPosition).not.toHaveBeenCalled();
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
      expectTravelled(scrollTop, (perSecond * 50) / 1000);
    });
  });

  /**
   * Two quick swipes in a row used to start the auto-scroll: it was enough
   * for two fingers to be lifted close together. A double tap is now two
   * real taps on a still page (see onGestureTouchEnd in useAutoScroll).
   */
  describe("the double tap, told apart from a fast scroll", () => {
    it("starts on two real taps, and stops on the next two", async () => {
      const { isAutoScrolling } = await import("../composables/useAutoScroll");
      const { host } = await mountReadingPage();
      const verse = host.querySelector("p")!;

      tap(verse);
      now += 100;
      tap(verse, 104, 303);
      expect(isAutoScrolling.value).toBe(true);

      // The page now moves by itself: that does not prevent stopping it,
      // even with the late scroll event of our last frame arriving under the
      // first finger.
      frames(30);
      pageScrolled();
      now += 1000;
      finger("touchstart", verse, 100, 300);
      pageScrolled();
      now += 60;
      finger("touchend", verse, 100, 300);
      now += 100;
      tap(verse);
      expect(isAutoScrolling.value).toBe(false);
    });

    it("does not start on two quick swipes", async () => {
      const { isAutoScrolling } = await import("../composables/useAutoScroll");
      const { host } = await mountReadingPage();
      const verse = host.querySelector("p")!;

      swipe(verse);
      now += 120;
      swipe(verse);
      expect(isAutoScrolling.value).toBe(false);

      // Nor through the `dblclick` the browser may send after them.
      doubleClick(verse);
      expect(isAutoScrolling.value).toBe(false);
    });

    it("does not count the touch that stops a coasting page", async () => {
      const { isAutoScrolling } = await import("../composables/useAutoScroll");
      const { host } = await mountReadingPage();
      const verse = host.querySelector("p")!;

      // The page is still coasting from a swipe when the finger lands.
      pageScrolled();
      now += 50;
      tap(verse);
      now += 100;
      tap(verse);
      expect(isAutoScrolling.value).toBe(false);

      // Once the page is still, the same two taps start it.
      now += 1000;
      tap(verse);
      now += 100;
      tap(verse);
      expect(isAutoScrolling.value).toBe(true);
    });

    it("does not join two taps that a scroll separates", async () => {
      const { isAutoScrolling } = await import("../composables/useAutoScroll");
      const { host } = await mountReadingPage();
      const verse = host.querySelector("p")!;

      tap(verse);
      pageScrolled();
      now += 100;
      tap(verse);
      expect(isAutoScrolling.value).toBe(false);
    });

    it("does not take a press held too long for a tap", async () => {
      const { isAutoScrolling } = await import("../composables/useAutoScroll");
      const { host } = await mountReadingPage();
      const verse = host.querySelector("p")!;

      tap(verse, 100, 300, 450);
      now += 100;
      tap(verse);
      expect(isAutoScrolling.value).toBe(false);
    });

    it("lets the dblclick finish a double tap whose first tap opened the passage", async () => {
      const { isAutoScrolling } = await import("../composables/useAutoScroll");
      const { useOverlay } = await import("../composables/useOverlayStack");
      const { effectScope } = await import("vue");
      const { host } = await mountReadingPage();
      const verse = host.querySelector("p")!;

      // The first tap chose the verse: its sheet is open when the second
      // touch is judged, and the touch listeners leave it alone.
      tap(verse);
      const sheet = effectScope();
      sheet.run(() => useOverlay(ref(true), () => {}));
      now += 100;
      tap(verse);
      expect(isAutoScrolling.value).toBe(false);

      // The second click released the verse, then the browser's dblclick.
      sheet.stop();
      now += 10;
      doubleClick(verse);
      expect(isAutoScrolling.value).toBe(true);
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

  /**
   * Le réglage fin : vingt crans au lieu de quatre allures (retour d'un
   * lecteur Android, 3.10.9). Ce qui doit tenir : les quatre allures nommées
   * tombent sur un cran à leur vitesse d'avant, au pixel près ; une allure
   * enregistrée par une version précédente se relit à l'identique ; et
   * l'ancienne clé reste écrite, pour une version plus ancienne réinstallée.
   */
  describe("réglage fin de l'allure", () => {
    it("garde les quatre allures nommées à leur vitesse, sur un cran chacune", async () => {
      const { AUTO_SCROLL_SPEEDS, AUTO_SCROLL_MIN_LEVEL, AUTO_SCROLL_MAX_LEVEL, ...module } =
        await import("../composables/useAutoScroll");
      expect(AUTO_SCROLL_MIN_LEVEL).toBe(1);
      expect(AUTO_SCROLL_MAX_LEVEL).toBe(20);
      const anciennes = { slow: 16, medium: 26, fast: 48, veryFast: 72 };
      for (const speed of AUTO_SCROLL_SPEEDS) {
        expect(speed.pixelsPerSecond).toBe(anciennes[speed.id]);
        expect(module.autoScrollPixelsPerSecond(speed.level)).toBe(speed.pixelsPerSecond);
        expect(module.nearestAutoScrollSpeedId(speed.level)).toBe(speed.id);
      }
    });

    it("monte à chaque cran, sans sortir de l'échelle", async () => {
      const { autoScrollPixelsPerSecond, AUTO_SCROLL_MIN_LEVEL, AUTO_SCROLL_MAX_LEVEL } =
        await import("../composables/useAutoScroll");
      for (let level = AUTO_SCROLL_MIN_LEVEL + 1; level <= AUTO_SCROLL_MAX_LEVEL; level++) {
        expect(autoScrollPixelsPerSecond(level)).toBeGreaterThan(
          autoScrollPixelsPerSecond(level - 1),
        );
      }
      expect(autoScrollPixelsPerSecond(0)).toBe(16);
      expect(autoScrollPixelsPerSecond(99)).toBe(72);
    });

    it.each([
      ["slow", 1],
      ["medium", 6],
      ["fast", 13],
      ["veryFast", 20],
    ])("relit l'allure « %s » d'une version précédente au cran %i", async (id, level) => {
      // Ce qu'écrivait la 3.10.9 : le nom de l'allure, et rien d'autre.
      localStorage.setItem("pj-autoscroll-speed", id);
      const module = await import("../composables/useAutoScroll");
      expect(module.autoScrollLevel.value).toBe(level);
      expect(module.autoScrollSpeedId.value).toBe(id);
    });

    it("préfère le cran à l'ancienne clé, et écarte une valeur qui n'en est pas un", async () => {
      localStorage.setItem("pj-autoscroll-speed", "fast");
      localStorage.setItem("pj-autoscroll-level", "9");
      expect((await import("../composables/useAutoScroll")).autoScrollLevel.value).toBe(9);

      // Hors de l'échelle ou illisible : on retombe sur l'ancienne clé.
      for (const abime of ["0", "21", "7.5", "vite"]) {
        vi.resetModules();
        localStorage.setItem("pj-autoscroll-level", abime);
        expect((await import("../composables/useAutoScroll")).autoScrollLevel.value).toBe(13);
      }

      // Ni l'une ni l'autre : l'allure la plus lente.
      vi.resetModules();
      localStorage.clear();
      expect((await import("../composables/useAutoScroll")).autoScrollLevel.value).toBe(1);
    });

    it("garde le cran au lancement suivant, et l'allure la plus proche pour une version plus ancienne", async () => {
      const module = await import("../composables/useAutoScroll");
      module.setAutoScrollLevel(11);
      expect(localStorage.getItem("pj-autoscroll-level")).toBe("11");
      // Une version qui ne connaît que les quatre allures lit « rapide » (13),
      // plus proche de 11 que « moyen » (6).
      expect(localStorage.getItem("pj-autoscroll-speed")).toBe("fast");

      vi.resetModules();
      const relaunched = await import("../composables/useAutoScroll");
      expect(relaunched.autoScrollLevel.value).toBe(11);
    });

    it("descend à la vitesse du cran choisi", async () => {
      const { setAutoScrollLevel, autoScrollPixelsPerSecond } = await import(
        "../composables/useAutoScroll"
      );
      const { host } = await mountReadingPage();
      setAutoScrollLevel(9);
      const perSecond = autoScrollPixelsPerSecond(9);
      expect(perSecond).toBeGreaterThan(26);
      expect(perSecond).toBeLessThan(48);

      doubleClick(host.querySelector("p")!);
      frame(16);
      frames(60);
      expectTravelled(scrollTop, (perSecond * 60 * 16) / 1000);
    });

    it("ne signale qu'un changement d'allure quand le pouce s'arrête", async () => {
      const capture = vi.fn();
      vi.doMock("../services/analyticsService", () => ({ analyticsService: { capture } }));
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        const { setAutoScrollLevel } = await import("../composables/useAutoScroll");
        // Un glissement du premier cran au huitième, cran par cran.
        for (let level = 2; level <= 8; level++) setAutoScrollLevel(level);
        expect(capture).not.toHaveBeenCalled();

        vi.runAllTimers();
        expect(capture).toHaveBeenCalledTimes(1);
        expect(capture).toHaveBeenCalledWith("auto_scroll_speed_changed", {
          speed: "medium",
          previous_speed: "slow",
          speed_level: 8,
          previous_speed_level: 1,
          running: false,
        });
      } finally {
        vi.useRealTimers();
        vi.doUnmock("../services/analyticsService");
      }
    });
  });
});
