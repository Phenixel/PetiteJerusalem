import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";

/**
 * The end of a reading, marked by pushing the page past its end
 * (PullToMark, docs/design.md, "An open volume, its settings, the reader").
 *
 * What must hold: the line takes no room and holds no touch back; it grows
 * into the card as it is pulled, one shape and never two that swap; only a
 * finger laid once the page can scroll no further, anywhere on the page,
 * fills the ring as it rises, and let go full, the reading is marked. The
 * finger that scrolls the page to its end never marks it, even if it keeps
 * going; a sideways swipe or a pinch is not a pull, and a sheet keeps its
 * own touches.
 */

vi.mock("../services/haptics", () => ({ haptic: vi.fn() }));

import PullToMark from "../components/parcours/PullToMark.vue";
import {
  END_PULL,
  FULL,
  FULL_HEIGHT,
  NO_PULL,
  REST,
  endPullLayout,
  movePull,
  pullGrowth,
  pullShare,
  startPull,
} from "../components/parcours/endPull";

describe("movePull", () => {
  it("pulls only with a finger laid at the end", () => {
    let state = startPull(100, 600, true);
    state = movePull(state, 100, 500, true);
    expect(state.rise).toBe(100);
  });

  it("never pulls with the finger that scrolled the page to its end", () => {
    // Laid before the end: the page scrolls, reaches its end, the finger
    // keeps going well past the threshold.
    let state = startPull(100, 640, false);
    state = movePull(state, 100, 500, false);
    state = movePull(state, 100, 480, true);
    state = movePull(state, 100, 480 - END_PULL * 2, true);
    expect(state.rise).toBe(0);
  });

  it("stops pulling when the page scrolls back up, until lifted", () => {
    let state = startPull(100, 600, true);
    state = movePull(state, 100, 500, true);
    expect(state.rise).toBe(100);
    state = movePull(state, 100, 650, false);
    expect(state).toEqual(NO_PULL);
    state = movePull(state, 100, 400, true);
    expect(state.rise).toBe(0);
  });

  it("does not take a sideways swipe for a pull", () => {
    let state = startPull(100, 600, true);
    state = movePull(state, 300, 520, true);
    expect(state.rise).toBe(0);
  });

  it("fills the ring at END_PULL, no further", () => {
    expect(pullShare(END_PULL / 2)).toBe(0.5);
    expect(pullShare(END_PULL * 2)).toBe(1);
  });
});

describe("endPullLayout", () => {
  it("starts as the line: a small ring beside its text, centered together", () => {
    const rest = endPullLayout(0, 200);
    expect(rest.height).toBe(REST.height);
    expect(rest.ring).toBe(REST.ring);
    expect(rest.lineOpacity).toBe(1);
    expect(rest.cardOpacity).toBe(0);
    // Ring, gap and text, centered as one: as far from the middle on each side.
    const start = rest.ringX - rest.ring / 2;
    expect(rest.lineX + 200).toBeCloseTo(-start);
  });

  it("ends as the card shown once done", () => {
    const full = endPullLayout(1, 200);
    expect(full.height).toBe(FULL_HEIGHT);
    expect(full.ring).toBe(FULL.ring);
    expect(full.ringX).toBe(0);
    expect(full.headingY).toBe(FULL.top);
    expect(full.lineOpacity).toBe(0);
    expect(full.cardOpacity).toBe(1);
  });

  it("grows step by step, never in one jump", () => {
    let previous = endPullLayout(0, 200);
    for (let i = 1; i <= 20; i++) {
      const next = endPullLayout(pullGrowth(i / 20), 200);
      expect(next.ring).toBeGreaterThan(previous.ring);
      expect(next.height).toBeGreaterThan(previous.height);
      expect(next.ring - previous.ring).toBeLessThan((FULL.ring - REST.ring) / 4);
      previous = next;
    }
  });
});

const VIEWPORT = 800;
const DOC_HEIGHT = 3000;
let scrollY = 0;

function touch(type: string, points: Array<{ x: number; y: number }>, target: EventTarget) {
  const event = new Event(type, { bubbles: true });
  const touches = points.map((p) => ({ clientX: p.x, clientY: p.y }));
  Object.defineProperty(event, "touches", { value: touches });
  target.dispatchEvent(event);
}

let app: App | null = null;
let host: HTMLElement;

async function mountEnd(done = false) {
  const marks = vi.fn();
  host = document.createElement("div");
  document.body.appendChild(host);
  app = createApp({
    render: () =>
      h(
        PullToMark,
        {
          done,
          heading: "Fin de la portion du jour",
          aria: "Marquer la portion faite",
          label: { pull: "Tirez vers le haut", release: "Relâchez", done: "Portion faite" },
          sub: {
            pull: "pour la marquer",
            release: "Elle sera marquée.",
            done: "Le signet a avancé.",
          },
          onMark: marks,
        },
        () => h("button", "Annuler"),
      ),
  });
  app.mount(host);
  await nextTick();
  const section = host.querySelector("section")!;
  // The line stands at the bottom of the screen.
  section.getBoundingClientRect = () => ({ top: VIEWPORT - 100, bottom: VIEWPORT }) as DOMRect;
  return { marks, section };
}

/** A finger laid on the text, far from the line, pushed up by `rise`. */
async function pull(rise: number, target: EventTarget = document.body) {
  touch("touchstart", [{ x: 150, y: 400 }], target);
  touch("touchmove", [{ x: 150, y: 400 - rise / 2 }], target);
  touch("touchmove", [{ x: 150, y: 400 - rise }], target);
  await nextTick();
  touch("touchend", [], target);
  await nextTick();
}

describe("PullToMark", () => {
  beforeEach(() => {
    scrollY = DOC_HEIGHT - VIEWPORT;
    Object.defineProperty(window, "scrollY", { get: () => scrollY, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: VIEWPORT, configurable: true });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      get: () => DOC_HEIGHT,
      configurable: true,
    });
  });
  afterEach(() => {
    app?.unmount();
    app = null;
    host.remove();
  });

  it("is marked by pushing the page past its end, from anywhere", async () => {
    const { marks, section } = await mountEnd();
    expect(section.classList.contains("is-growing")).toBe(true);
    touch("touchstart", [{ x: 150, y: 400 }], document.body);
    touch("touchmove", [{ x: 150, y: 400 - END_PULL - 10 }], document.body);
    await nextTick();
    expect(section.textContent).toContain("Relâchez");
    touch("touchend", [], document.body);
    expect(marks).toHaveBeenCalledTimes(1);
  });

  it("is not marked by a short pull", async () => {
    const { marks, section } = await mountEnd();
    await pull(END_PULL / 2);
    expect(marks).not.toHaveBeenCalled();
    expect(section.textContent).toContain("Tirez vers le haut");
  });

  it("is never marked by the finger that scrolled to the end", async () => {
    scrollY = DOC_HEIGHT - VIEWPORT - 130;
    const { marks } = await mountEnd();
    touch("touchstart", [{ x: 200, y: 640 }], document.body);
    touch("touchmove", [{ x: 200, y: 560 }], document.body);
    // The page reaches its end under the finger, which keeps going.
    scrollY = DOC_HEIGHT - VIEWPORT;
    touch("touchmove", [{ x: 200, y: 500 }], document.body);
    touch("touchmove", [{ x: 200, y: 500 - END_PULL * 2 }], document.body);
    touch("touchend", [], document.body);
    expect(marks).not.toHaveBeenCalled();
    // Laid again, now at the end: that one pulls.
    await pull(END_PULL + 20);
    expect(marks).toHaveBeenCalledTimes(1);
  });

  it("lets the page scroll before its end", async () => {
    scrollY = 500;
    const { marks } = await mountEnd();
    await pull(END_PULL * 2);
    expect(marks).not.toHaveBeenCalled();
  });

  it("leaves a pinch and a sheet alone", async () => {
    const { marks } = await mountEnd();
    touch("touchstart", [{ x: 150, y: 400 }], document.body);
    touch(
      "touchmove",
      [
        { x: 150, y: 200 },
        { x: 250, y: 100 },
      ],
      document.body,
    );
    touch("touchmove", [{ x: 150, y: 100 }], document.body);
    touch("touchend", [], document.body);
    const sheet = document.createElement("div");
    sheet.setAttribute("role", "dialog");
    document.body.appendChild(sheet);
    await pull(END_PULL * 2, sheet);
    sheet.remove();
    expect(marks).not.toHaveBeenCalled();
  });

  it("once done, shows the full card and listens no more", async () => {
    const { marks, section } = await mountEnd(true);
    expect(section.classList.contains("is-done")).toBe(true);
    expect(section.textContent).toContain("Portion faite");
    expect(section.textContent).toContain("Annuler");
    await pull(END_PULL * 2);
    expect(marks).not.toHaveBeenCalled();
  });

  it("stays a button for the keyboard", async () => {
    const { marks, section } = await mountEnd();
    section.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(marks).toHaveBeenCalledTimes(1);
  });
});
