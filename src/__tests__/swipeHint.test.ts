import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, type Ref } from "vue";

/**
 * The swipe shown (composables/useSwipeHint.ts): rarely, and only to whoever
 * seems not to know the gesture. No swipe for three days, no hint for a day,
 * eight seconds without a touch on the page; once per visit.
 */

// jsdom has no canvas: the small-machine check would turn the motion off.
vi.mock("../composables/useMotion", () => ({ prefersLessMotion: () => false }));

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-21T07:30:00Z").getTime();

type Hint = typeof import("../composables/useSwipeHint");

async function load(): Promise<Hint> {
  return import("../composables/useSwipeHint");
}

async function mount(ready = () => true): Promise<{ hinting: Ref<boolean>; unmount: () => void }> {
  const { useSwipeHint } = await load();
  let hinting: Ref<boolean> | null = null;
  const app = createApp(
    defineComponent({
      setup() {
        hinting = useSwipeHint(ready).hinting;
        return () => h("div");
      },
    }),
  );
  app.mount(document.createElement("div"));
  return { hinting: hinting!, unmount: () => app.unmount() };
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  vi.resetModules();
  localStorage.clear();
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});
afterEach(() => vi.useRealTimers());

describe("the swipe shown", () => {
  it("is due only after three days without a swipe, and once a day at most", async () => {
    const { swipeHintDue } = await load();
    expect(swipeHintDue({ swipedAt: 0, hintedAt: 0 }, NOW)).toBe(true);
    expect(swipeHintDue({ swipedAt: NOW - DAY, hintedAt: 0 }, NOW)).toBe(false);
    expect(swipeHintDue({ swipedAt: NOW - 4 * DAY, hintedAt: NOW - 2 * 3600_000 }, NOW)).toBe(
      false,
    );
    expect(swipeHintDue({ swipedAt: NOW - 4 * DAY, hintedAt: NOW - DAY }, NOW)).toBe(true);
  });

  it("plays after eight seconds without a gesture, then stops", async () => {
    const { hinting } = await mount();
    vi.advanceTimersByTime(7900);
    expect(hinting.value).toBe(false);
    vi.advanceTimersByTime(200);
    expect(hinting.value).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(hinting.value).toBe(false);
  });

  it("waits again after a touch or a scroll", async () => {
    const { hinting } = await mount();
    vi.advanceTimersByTime(6000);
    window.dispatchEvent(new Event("pointerdown"));
    vi.advanceTimersByTime(6000);
    expect(hinting.value).toBe(false);
    vi.advanceTimersByTime(2100);
    expect(hinting.value).toBe(true);
  });

  it("does not come back the same day, nor to whoever just swiped", async () => {
    const first = await mount();
    vi.advanceTimersByTime(8100);
    expect(first.hinting.value).toBe(true);
    first.unmount();
    vi.advanceTimersByTime(3600_000);
    const second = await mount();
    vi.advanceTimersByTime(60_000);
    expect(second.hinting.value).toBe(false);
    second.unmount();

    localStorage.clear();
    const { noteSwipe } = await load();
    noteSwipe();
    const third = await mount();
    vi.advanceTimersByTime(60_000);
    expect(third.hinting.value).toBe(false);
  });

  it("waits while there is nothing to swipe", async () => {
    let ready = false;
    const { hinting } = await mount(() => ready);
    vi.advanceTimersByTime(20_000);
    expect(hinting.value).toBe(false);
    // The wait goes round every eight seconds: the next turn, at 24 s, plays.
    ready = true;
    vi.advanceTimersByTime(4100);
    expect(hinting.value).toBe(true);
  });
});
