import { nextTick, reactive } from "vue";
import {
  isQuietModeOn,
  openQuietAccessSettings,
  quietModesSupported,
  setQuietMode,
  watchQuietState,
  type QuietMode,
  type QuietState,
} from "../services/prayerQuiet";
import { SHEET_EASING } from "../components/chiourim/sheetMotion";
import { hasOpenOverlay } from "./useOverlayStack";
import { isOnboardingOpen } from "./useOnboarding";

/**
 * When a tefila opens, the whole app goes down and a panel opens at the top
 * of the screen, as when the screen is split in two, to quiet the phone
 * before praying: Do Not Disturb, silent, vibrate, each with the phone's
 * current state (PrayerQuietPanel.vue, docs/design.md « A tefila opens on
 * the phone's quiet modes »).
 *
 * Two pieces of state live here, at the app's level:
 *  - the panel and the phone's state (`prayerQuiet`), opened by the reading
 *    page, closed by the panel;
 *  - the app's stage (`appDrop`), the wrapper of everything in App.vue: held
 *    in place while it is lowered, and lowered by `offset` pixels.
 */

export const prayerQuiet = reactive({
  open: false,
  state: null as QuietState | null,
  /**
   * After a change refused for lack of Do Not Disturb access: "access" once
   * the settings list is opened (the change is made on return), "unavailable"
   * when the phone has no such list.
   */
  hint: null as "access" | "unavailable" | null,
});

/**
 * The app's stage. Held (`held`), it is fixed to the screen and its content
 * keeps where it was scrolled (`scrollY`): what moves is then a translation
 * of the whole screen, bottom bar included, which a translation of the page
 * alone would leave behind (a fixed element follows the transformed box that
 * contains it, and the page is as tall as its text).
 */
export const appDrop = reactive({
  held: false,
  offset: 0,
  scrollY: 0,
  /** The finger is moving it: no easing, it follows. */
  dragging: false,
});

/**
 * The app's descent and rise: the reading sheet's duration and curve
 * (docs/design.md, « A bottom sheet moves like the system's »).
 */
export const DROP_MS = 360;
export const DROP_TRANSITION = `transform ${DROP_MS}ms ${SHEET_EASING}`;

/**
 * Between the tefila shown and the app going down: long enough to see what
 * opened, short enough to answer the tap that opened it.
 */
export const PRAYER_QUIET_DELAY_MS = 400;

/** Within this delay after closing, the next tefila does not offer it again. */
export const REOFFER_AFTER_MS = 15 * 60 * 1000;

let lastClosedAt = 0;
let opening = false;
let stopWatching: (() => void) | null = null;
/** The change asked for while access was missing, made once it is granted. */
let pending: { mode: QuietMode; on: boolean } | null = null;
const busy = new Set<QuietMode>();

/**
 * Opens the panel, from a tefila that has just opened. Nothing outside the
 * Android app, on a binary older than the plugin, over another window or the
 * introduction, or again right after it was closed (Min'ha then Arvit: the
 * phone is still as it was set).
 */
export async function offerPrayerQuiet(now = Date.now()): Promise<boolean> {
  if (!quietModesSupported || prayerQuiet.open || opening) return false;
  if (lastClosedAt && now - lastClosedAt < REOFFER_AFTER_MS) return false;
  if (isOnboardingOpen.value || hasOpenOverlay()) return false;
  opening = true;
  try {
    const { state, stop } = await watchQuietState(onState);
    if (!state) return false;
    stopWatching = stop;
    prayerQuiet.state = state;
    prayerQuiet.hint = null;
    prayerQuiet.open = true;
    return true;
  } finally {
    opening = false;
  }
}

/** Closes the panel (once the app is back up, see PrayerQuietPanel). */
export function closePrayerQuiet(now = Date.now()): void {
  if (!prayerQuiet.open) return;
  prayerQuiet.open = false;
  prayerQuiet.hint = null;
  lastClosedAt = now;
  pending = null;
  stopWatching?.();
  stopWatching = null;
}

function onState(state: QuietState): void {
  prayerQuiet.state = state;
  // Back from the settings with the access granted: the change asked for
  // before is made now, without a second tap.
  if (pending && state.access) {
    const { mode, on } = pending;
    pending = null;
    prayerQuiet.hint = null;
    if (isQuietModeOn(state, mode) !== on) void toggleQuietMode(mode, on);
  }
}

/** A row touched: the phone's mode is changed, or its access asked for. */
export async function toggleQuietMode(mode: QuietMode, on: boolean): Promise<void> {
  if (busy.has(mode)) return;
  busy.add(mode);
  try {
    const result = await setQuietMode(mode, on);
    prayerQuiet.state = { dnd: result.dnd, ringer: result.ringer, access: result.access };
    if (result.applied || result.access) return;
    // Refused for lack of access: the system list where it is granted,
    // opened by this tap (docs/design.md, « A permission is requested after
    // a gesture, never in the background »).
    pending = { mode, on };
    prayerQuiet.hint = (await openQuietAccessSettings()) ? "access" : "unavailable";
    if (prayerQuiet.hint === "unavailable") pending = null;
  } catch {
    // Binary without the method: the row keeps showing the phone's state.
  } finally {
    busy.delete(mode);
  }
}

/** Holds the stage where it is, before lowering it. */
export function holdApp(): void {
  if (appDrop.held) return;
  appDrop.scrollY = window.scrollY;
  appDrop.offset = 0;
  appDrop.held = true;
}

/** Gives the page back its scrolling, where it was. */
export async function releaseApp(): Promise<void> {
  if (!appDrop.held) return;
  const top = appDrop.scrollY;
  appDrop.held = false;
  appDrop.offset = 0;
  appDrop.dragging = false;
  await nextTick();
  window.scrollTo({ top, behavior: "instant" });
}

/** For tests: back to the start. */
export function resetPrayerQuiet(): void {
  stopWatching?.();
  stopWatching = null;
  pending = null;
  lastClosedAt = 0;
  opening = false;
  busy.clear();
  prayerQuiet.open = false;
  prayerQuiet.state = null;
  prayerQuiet.hint = null;
  appDrop.held = false;
  appDrop.offset = 0;
  appDrop.scrollY = 0;
  appDrop.dragging = false;
}
