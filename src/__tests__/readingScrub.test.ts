import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App, type Component } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";

/**
 * The progress bar that slides, and the menu button that names the passage.
 *
 * What must hold: a finger on the bar takes the page to the same share of the
 * text (from the right in Hebrew); while it slides, the titles of the text
 * line up on an arc, the one being read large in the middle, its neighbors
 * smaller, lower and fainter, the next one growing as it comes nearer; and,
 * on a text with landmarks, the round menu button grows around the title
 * being read as soon as one scrolls. See docs/design.md, "The progress bar
 * takes you through the text".
 */

vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn() },
}));
vi.mock("../composables/useNativeApp", () => ({ isNativeApp: false, appPlatform: "web" }));

import fr from "../locales/fr";
import ReadingMenu from "../components/ReadingMenu.vue";
import ReadingProgressBar from "../components/ReadingProgressBar.vue";
import { analyticsService } from "../services/analyticsService";
import { arcPlacement, scrubFraction } from "../composables/readingScrub";
import { readingScrubbing, readingSections, sectionPosition } from "../composables/useReadingNav";

const SECTIONS = [
  { anchor: "b0", offset: 0, label: "Bénédictions du matin", hebrew: "ברכות השחר" },
  { anchor: "b1", offset: 12, label: "Les téfilines", hebrew: "מצות תפילין" },
  { anchor: "b2", offset: 30, label: "Amida" },
];
/** Where each title stands in the page, in pixels from its top. */
const TOPS = [200, 1500, 3000];
const DOC_HEIGHT = 5000;
const VIEWPORT = 800;

let scrollY = 0;
const scrollTo = vi.fn((options: ScrollToOptions) => {
  scrollY = options.top ?? 0;
  window.dispatchEvent(new Event("scroll"));
});

/** A tall page whose landmarks stand at TOPS. */
function stubPage() {
  scrollY = 0;
  Object.defineProperty(window, "scrollY", { get: () => scrollY, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: VIEWPORT, configurable: true });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    get: () => DOC_HEIGHT,
    configurable: true,
  });
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  SECTIONS.forEach((section, i) => {
    const el = document.createElement("div");
    el.dataset.blockAnchor = section.anchor;
    el.getBoundingClientRect = () => ({ top: TOPS[i] - scrollY }) as DOMRect;
    document.body.appendChild(el);
  });
}

async function frames() {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await nextTick();
}

let apps: App[] = [];

async function mount(component: Component, props: Record<string, unknown> = {}) {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:chemin(.*)*", component: { render: () => null } }],
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(component, props) });
  app.use(i18n).use(router);
  app.mount(host);
  apps.push(app);
  await router.isReady();
  await frames();
  return host;
}

beforeEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  vi.mocked(analyticsService.capture).mockClear();
  scrollTo.mockClear();
  stubPage();
});

afterEach(() => {
  apps.forEach((app) => app.unmount());
  apps = [];
  readingSections.value = [];
});

describe("the geometry of the slide", () => {
  it("reads the share of the text under the finger, from the right in Hebrew", () => {
    const rect = { left: 0, width: 400 };
    expect(scrubFraction(100, rect, false)).toBe(0.25);
    expect(scrubFraction(100, rect, true)).toBe(0.75);
    // Past the ends, the text stops at its ends.
    expect(scrubFraction(-50, rect, false)).toBe(0);
    expect(scrubFraction(900, rect, false)).toBe(1);
  });

  it("places the reading line among the titles as a fractional rank", () => {
    expect(sectionPosition([], 100)).toBe(-1);
    // Above the first title: from -1 (top of the page) to 0.
    expect(sectionPosition(TOPS, 100)).toBeCloseTo(-0.5);
    expect(sectionPosition(TOPS, 200)).toBe(0);
    // Halfway between the second and the third title.
    expect(sectionPosition(TOPS, 2250)).toBe(1.5);
    // Past the last one, it stays on it.
    expect(sectionPosition(TOPS, 4900)).toBe(2);
  });

  it("puts the title reached large in the middle, and its neighbors smaller, lower, fainter", () => {
    const middle = arcPlacement(0);
    expect(middle).toMatchObject({ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 });

    const next = arcPlacement(1);
    expect(next.x).toBeGreaterThan(0);
    expect(next.y).toBeGreaterThan(0);
    expect(next.scale).toBeLessThan(1);
    expect(next.opacity).toBeLessThan(1);
    // The arc is the same on both sides.
    expect(arcPlacement(-1).y).toBe(next.y);
    expect(arcPlacement(-1).x).toBe(-next.x);

    // The next title grows as it comes nearer.
    expect(arcPlacement(0.5).scale).toBeGreaterThan(next.scale);
    expect(arcPlacement(0.5).scale).toBeLessThan(1);

    // In Hebrew, the text moves forward to the left.
    expect(arcPlacement(1, true).x).toBe(-next.x);
  });
});

describe("the progress bar", () => {
  function strip(host: HTMLElement) {
    return host.querySelector<HTMLElement>(".scrub-strip")!;
  }

  function press(el: HTMLElement, type: string, clientX: number) {
    el.dispatchEvent(new MouseEvent(type, { clientX, button: 0, bubbles: true }));
  }

  it("takes the page to the share under the finger, and shows the titles it passes", async () => {
    readingSections.value = SECTIONS;
    const host = await mount(ReadingProgressBar);
    const bar = strip(host);
    bar.getBoundingClientRect = () => ({ left: 0, width: 1000 }) as DOMRect;

    // Halfway: 0.5 × (5000 - 800).
    press(bar, "pointerdown", 500);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 2100, behavior: "instant" });
    expect(readingScrubbing.value).toBe(true);
    await frames();

    // The reading line is in the second section: its title is in the middle,
    // the largest, and the third one is coming.
    const titles = [...host.querySelectorAll<HTMLElement>(".scrub-title")];
    const scale = (label: string) => {
      const title = titles.find((el) => el.textContent?.includes(label))!;
      return Number(/scale\(([\d.]+)\)/.exec(title.style.transform)![1]);
    };
    expect(titles.map((el) => el.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("Les téfilines")]),
    );
    expect(scale("Les téfilines")).toBeGreaterThan(scale("Amida"));
    // The share reached stays in the middle, above the titles.
    expect(host.querySelector(".scrub-percent")?.textContent).toMatch(/^50[\u00a0\u202f]%$/);
    expect(scale("Les téfilines")).toBeGreaterThan(scale("Bénédictions du matin"));

    // Nearer to the Amida, it grows, and the téfilines shrink away.
    const before = scale("Amida");
    press(bar, "pointermove", 650);
    await frames();
    const after = [...host.querySelectorAll<HTMLElement>(".scrub-title")].find((el) =>
      el.textContent?.includes("Amida"),
    )!;
    expect(Number(/scale\(([\d.]+)\)/.exec(after.style.transform)![1])).toBeGreaterThan(before);

    press(bar, "pointerup", 650);
    await frames();
    expect(readingScrubbing.value).toBe(false);
    expect(host.querySelector(".scrub-panel")).toBeNull();
    expect(analyticsService.capture).toHaveBeenCalledWith("reading_scrubbed", {
      sections_count: 3,
      from_progress: 0,
      to_progress: 0.65,
    });
  });

  it("shows the share reached on a text without titles", async () => {
    const host = await mount(ReadingProgressBar);
    const bar = strip(host);
    bar.getBoundingClientRect = () => ({ left: 0, width: 1000 }) as DOMRect;

    press(bar, "pointerdown", 420);
    await frames();
    expect(host.querySelector(".scrub-title")).toBeNull();
    // « 42 % », the sign never cut from its number.
    expect(host.querySelector(".scrub-panel")?.textContent?.trim()).toMatch(/^42[\u00a0\u202f]%$/);
  });
});

describe("the menu button", () => {
  function peek(host: HTMLElement) {
    return host.querySelector<HTMLElement>(".fab-peek")!;
  }

  it("names the passage being read as soon as one scrolls, then shrinks back", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const host = await mount(ReadingMenu, { sections: SECTIONS });
      expect(peek(host).classList.contains("fab-peek-shown")).toBe(false);

      scrollTo({ top: 1600 });
      await frames();
      expect(peek(host).classList.contains("fab-peek-shown")).toBe(true);
      expect(peek(host).textContent).toBe("Les téfilines");
      // The button keeps its name: the title is a hint for the eye.
      const button = host.querySelector('button[aria-haspopup="menu"]')!;
      expect(button.getAttribute("aria-label")).toBe(fr.textReading.navMenu);

      vi.advanceTimersByTime(2000);
      await nextTick();
      expect(peek(host).classList.contains("fab-peek-shown")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stays a round button on a text without landmarks", async () => {
    const host = await mount(ReadingMenu);
    scrollTo({ top: 1600 });
    await frames();
    expect(peek(host).classList.contains("fab-peek-shown")).toBe(false);
  });

  it("steps aside while the progress bar slides", async () => {
    const host = await mount(ReadingMenu, { sections: SECTIONS });
    scrollTo({ top: 1600 });
    await frames();
    const fabs = host.querySelector<HTMLElement>(".fixed.right-6")!;
    expect(fabs.style.display).not.toBe("none");
    readingScrubbing.value = true;
    await frames();
    expect(fabs.style.display).toBe("none");
    readingScrubbing.value = false;
  });
});
