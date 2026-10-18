import { ref } from "vue";
import { prefersReducedMotion } from "./useMotion";

/**
 * The bottom bar replays its own change (the "what's new" tour, see
 * WhatsNewTour.vue): the bar of the version people knew (Accueil,
 * Bibliothèque, Chiourim, Profil) turns, in front of them, into the one they
 * now have. The library book jumps over the times circle and merges
 * into the Chiourim tab, which becomes Étude; then Sidour rises in the place
 * the book left.
 *
 * The scene is played by the bar itself (BottomTabBar.vue), on the real
 * slots: it ends exactly where the real tabs are, which then take over
 * without a jump. Three states:
 *
 *  - `held`: at the opening, the bar shows the old tabs, still, while the
 *    tour gets ready. The app opens as people knew it, and the change then
 *    happens in front of them, not before they look;
 *  - `playing`: the change plays out, once;
 *  - `off`: the real tabs.
 *
 * Cut only when the system asks for fewer animations: the scene is what says
 * what moved, and it only touches transforms and opacity (see
 * docs/design.md, "What's new plays out once, after an update").
 */

export type TabBarChangeState = "off" | "held" | "playing";

export const tabBarChange = ref<TabBarChangeState>("off");

/** Each run gets its own number: replaying restarts the animations. */
export const tabBarChangeRun = ref(0);

/**
 * The scene ends on its last animation; this bound is there in case it
 * never fires (the app sent to the background mid-scene): the real tabs
 * must never stay hidden.
 */
const SCENE_MAX_MS = 4500;
let fallback: ReturnType<typeof setTimeout> | null = null;

/** A held bar the tour never claimed (it could not show) lets go by then. */
const HOLD_MAX_MS = 5000;

/** The old tabs, still, until the tour plays the change. */
export function holdTabBarChange(): void {
  if (prefersReducedMotion() || tabBarChange.value !== "off") return;
  tabBarChangeRun.value += 1;
  tabBarChange.value = "held";
  if (fallback) clearTimeout(fallback);
  fallback = setTimeout(stopTabBarChange, HOLD_MAX_MS);
}

/** Play the change: from the held bar, or again from the start (« Revoir »). */
export function playTabBarChange(): void {
  if (prefersReducedMotion()) return;
  if (tabBarChange.value !== "held") tabBarChangeRun.value += 1;
  tabBarChange.value = "playing";
  if (fallback) clearTimeout(fallback);
  fallback = setTimeout(stopTabBarChange, SCENE_MAX_MS);
}

/** The scene ended, or the tour left it: the real tabs are back. */
export function stopTabBarChange(): void {
  if (fallback) clearTimeout(fallback);
  fallback = null;
  tabBarChange.value = "off";
}
