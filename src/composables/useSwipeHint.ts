import { onMounted, onUnmounted, ref } from "vue";
import { devicePreference } from "../services/devicePreference";
import { isOnboardingOpen } from "./useOnboarding";
import { tipOnScreen } from "./useFeatureTips";
import { prefersLessMotion } from "./useMotion";

/**
 * The swipe, shown: the card that can be swiped (the home stack's top card,
 * the Sidour's card of the moment) moves a little to the right on its own,
 * the « C'est fait » pill showing, then springs back, as if a finger had
 * started the gesture and let go (docs/design.md, « A gesture is shown,
 * rarely »).
 *
 * Rarely, and only to whoever seems not to know it:
 *
 *  - no swipe on this device for `QUIET_MS` (three days), or ever;
 *  - at most once every `EVERY_MS` (a day), wherever it played;
 *  - only after `IDLE_MS` (eight seconds) without a touch, a key or a
 *    scroll on the page, the page in view, no tip or introduction on screen;
 *  - once per visit of the page, and never with less motion asked for.
 *
 * Any swipe (done, later, on a line) is noted with `noteSwipe`: whoever
 * swipes knows the gesture, and is left alone.
 */

export const SWIPE_HINT_IDLE_MS = 8000;
export const SWIPE_HINT_QUIET_MS = 3 * 24 * 60 * 60 * 1000;
export const SWIPE_HINT_EVERY_MS = 24 * 60 * 60 * 1000;
/** How long the motion lasts (the CSS animations follow it). */
export const SWIPE_HINT_MS = 1600;

/** What the device remembers: the last swipe, the last hint (ms, 0: never). */
export interface SwipeHintMemory {
  swipedAt: number;
  hintedAt: number;
}

const store = devicePreference<SwipeHintMemory>(
  "pj_swipe_hint",
  (raw) => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<SwipeHintMemory>;
      return {
        swipedAt: typeof parsed.swipedAt === "number" ? parsed.swipedAt : 0,
        hintedAt: typeof parsed.hintedAt === "number" ? parsed.hintedAt : 0,
      };
    } catch {
      return null;
    }
  },
  (memory) => JSON.stringify(memory),
);

const memory = (): SwipeHintMemory => store.read() ?? { swipedAt: 0, hintedAt: 0 };

/** Is it time to show the gesture? No swipe for long, no hint for a day. */
export function swipeHintDue(state: SwipeHintMemory, now: number): boolean {
  return now - state.swipedAt >= SWIPE_HINT_QUIET_MS && now - state.hintedAt >= SWIPE_HINT_EVERY_MS;
}

/** A swipe was made, anywhere: the gesture is known. */
export function noteSwipe(): void {
  store.write({ ...memory(), swipedAt: Date.now() });
}

const ACTIVITY = ["pointerdown", "keydown", "wheel", "scroll", "touchstart"] as const;

/**
 * `ready`: the page has a card to swipe right now (not a service whose time
 * has not come, not the edit mode of the home page).
 */
export function useSwipeHint(ready: () => boolean) {
  const hinting = ref(false);
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let endTimer: ReturnType<typeof setTimeout> | undefined;
  let played = false;

  function arm(): void {
    clearTimeout(idleTimer);
    if (played) return;
    idleTimer = setTimeout(fire, SWIPE_HINT_IDLE_MS);
  }

  function fire(): void {
    const now = Date.now();
    if (!swipeHintDue(memory(), now)) {
      played = true;
      return;
    }
    const busy =
      document.visibilityState !== "visible" ||
      isOnboardingOpen.value ||
      tipOnScreen() ||
      prefersLessMotion() ||
      !ready();
    if (busy) {
      arm();
      return;
    }
    played = true;
    store.write({ ...memory(), hintedAt: now });
    hinting.value = true;
    endTimer = setTimeout(() => (hinting.value = false), SWIPE_HINT_MS);
  }

  /** A touch, a key, a scroll: the person is doing something; the wait restarts. */
  function onActivity(): void {
    if (hinting.value) hinting.value = false;
    arm();
  }

  onMounted(() => {
    if (!swipeHintDue(memory(), Date.now())) return;
    for (const type of ACTIVITY) {
      window.addEventListener(type, onActivity, { passive: true, capture: true });
    }
    arm();
  });

  onUnmounted(() => {
    clearTimeout(idleTimer);
    clearTimeout(endTimer);
    for (const type of ACTIVITY) {
      window.removeEventListener(type, onActivity, { capture: true });
    }
  });

  return { hinting };
}
