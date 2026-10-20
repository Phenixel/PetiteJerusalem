import { nextTick, reactive, ref } from "vue";
import { i18n } from "../i18n";
import { SHEET_EASING } from "../components/chiourim/sheetMotion";
import { devicePreference } from "../services/devicePreference";
import {
  isQuietModeOn,
  openQuietAccessSettings,
  quietModesSupported,
  readQuietState,
  setDnd,
  setQuietMode,
  setRinger,
  watchQuietState,
  type QuietMode,
  type QuietState,
  type RingerMode,
} from "../services/prayerQuiet";
import { hasOpenOverlay } from "./useOverlayStack";
import { isOnboardingOpen } from "./useOnboarding";
import { useToast } from "./useToast";

/**
 * When a tefila opens, a panel comes down from the top of the screen and
 * pushes the whole app down, to quiet the phone before praying: Do Not
 * Disturb, silent, vibrate, each with the phone's current state
 * (PrayerQuietPanel.vue, docs/design.md « A tefila opens on the phone's
 * quiet modes »).
 *
 * What is changed is changed for the prayer: once the tefila is left, the
 * phone goes back to how it was (`enterPrayer` / `leavePrayer`). The panel
 * also offers to stop offering it, or to apply the same modes to every
 * tefila from then on (`prayerQuietChoice`).
 *
 * Three pieces of state live here, at the app's level:
 *  - the panel and the phone's state (`prayerQuiet`);
 *  - the prayer under way (`session`): the phone as it was before, and what
 *    was changed since, so that leaving undoes exactly that;
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
 * The app's descent and rise, and the panel's with it: the reading sheet's
 * duration and curve (docs/design.md, « A bottom sheet moves like the
 * system's »).
 */
export const DROP_MS = 360;
export const DROP_TRANSITION = `transform ${DROP_MS}ms ${SHEET_EASING}`;

/**
 * Between the tefila shown and the panel coming down: long enough to see
 * what opened, short enough to answer the tap that opened it.
 */
export const PRAYER_QUIET_DELAY_MS = 400;

/**
 * Between leaving a tefila and the phone set back: the next one opened in
 * the meantime (Min'ha then Arvit) continues the same prayer, and the phone
 * stays as it is.
 */
export const LEAVE_GRACE_MS = 3000;

/** The modes kept for every tefila: those that were on when it was chosen. */
export interface PrayerQuietWish {
  dnd: boolean;
  ringer: "vibrate" | "silent" | null;
}

/**
 * What a tefila does when it opens: offer the panel (the default), apply
 * the modes kept (`wish`) without asking, or nothing at all. The wish stays
 * when another choice is made, so that it can be chosen again from the
 * settings.
 */
export interface PrayerQuietChoice {
  mode: "offer" | "always" | "never";
  wish: PrayerQuietWish | null;
}

const DEFAULT_CHOICE: PrayerQuietChoice = { mode: "offer", wish: null };

function parseChoice(raw: string | null): PrayerQuietChoice | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PrayerQuietChoice>;
    if (value.mode !== "offer" && value.mode !== "always" && value.mode !== "never") return null;
    const wish = value.wish;
    const ringer = wish?.ringer === "vibrate" || wish?.ringer === "silent" ? wish.ringer : null;
    return {
      mode: value.mode === "always" && !wish ? "offer" : value.mode,
      wish: wish ? { dnd: wish.dnd === true, ringer } : null,
    };
  } catch {
    return null;
  }
}

const choiceStore = devicePreference("pj-prayer-quiet", parseChoice, (value) =>
  JSON.stringify(value),
);
const storedChoice = choiceStore.read();
const choice = ref<PrayerQuietChoice>(storedChoice ?? DEFAULT_CHOICE);
let choiceRestored = storedChoice !== null;

export const prayerQuietChoice = choice;

/** The settings screen reads it back from the native preferences. */
export async function restorePrayerQuietChoice(): Promise<void> {
  if (choiceRestored) return;
  choiceRestored = true;
  const saved = await choiceStore.restore();
  if (saved) choice.value = saved;
}

export function setPrayerQuietChoice(next: PrayerQuietChoice): void {
  choiceRestored = true;
  choice.value = next;
  choiceStore.write(next);
}

/**
 * The prayer under way: the phone before it, and what was changed since
 * (the value set, per setting). Kept on the device too, so that an app
 * closed in the middle of a tefila still sets the phone back the next time
 * it opens.
 */
interface PrayerSession {
  before: { dnd: boolean; ringer: RingerMode };
  set: { dnd?: boolean; ringer?: RingerMode };
}

function parseSession(raw: string | null): PrayerSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as PrayerSession;
    if (typeof value?.before?.dnd !== "boolean" || typeof value.before.ringer !== "string") {
      return null;
    }
    return { before: value.before, set: value.set ?? {} };
  } catch {
    return null;
  }
}

const sessionStore = devicePreference("pj-prayer-quiet-session", parseSession, (value) =>
  JSON.stringify(value),
);

let session: PrayerSession | null = null;
/** Counts the entries and exits: an answer that arrives after the exit is dropped. */
let generation = 0;
let inPrayer = false;
let revertTimer: ReturnType<typeof setTimeout> | undefined;
let stopWatching: (() => void) | null = null;
/** The change asked for while access was missing, made once it is granted. */
let pending: { mode: QuietMode; on: boolean } | null = null;
const busy = new Set<QuietMode>();

function remember(): void {
  if (!session) return;
  if (session.set.dnd === undefined && session.set.ringer === undefined) sessionStore.clear();
  else sessionStore.write(session);
}

/** Records what the app has just set, against how the phone was before. */
function record(state: QuietState, mode: QuietMode): void {
  if (!session) return;
  if (mode === "dnd") {
    if (state.dnd === session.before.dnd) delete session.set.dnd;
    else session.set.dnd = state.dnd;
  } else if (state.ringer === session.before.ringer) {
    delete session.set.ringer;
  } else {
    session.set.ringer = state.ringer;
  }
  remember();
}

/**
 * A tefila is shown. The same prayer continues if one was left a moment ago;
 * otherwise, following the choice made: the panel, the modes kept applied
 * without asking (the panel comes instead if the phone refuses one), or
 * nothing. Nothing outside the Android app, nor on a binary older than the
 * plugin.
 */
export async function enterPrayer(): Promise<void> {
  if (!quietModesSupported || inPrayer) return;
  inPrayer = true;
  const entry = ++generation;
  if (revertTimer !== undefined) {
    clearTimeout(revertTimer);
    revertTimer = undefined;
    return;
  }
  if (!choiceRestored) await restorePrayerQuietChoice();
  const state = await readQuietState();
  if (!state || entry !== generation) return;
  // An app closed during a tefila: the phone is still as that prayer left
  // it, and this one takes over the way back.
  const leftover = session ?? sessionStore.read() ?? (await sessionStore.restore());
  if (entry !== generation) return;
  session = leftover ?? { before: { dnd: state.dnd, ringer: state.ringer }, set: {} };
  const { mode, wish } = choice.value;
  if (mode === "never") return;
  if (mode === "always" && wish && (await applyWish(wish, state, entry))) return;
  if (entry !== generation) return;
  if (isOnboardingOpen.value || hasOpenOverlay()) return;
  await openPanel(entry);
}

/** The modes kept for every tefila; false if the phone refused one. */
async function applyWish(
  wish: PrayerQuietWish,
  state: QuietState,
  entry: number,
): Promise<boolean> {
  let changed = false;
  try {
    if (wish.dnd && !state.dnd) {
      const result = await setDnd(true);
      if (!result.applied) return false;
      record(result, "dnd");
      changed = true;
    }
    if (wish.ringer && state.ringer !== wish.ringer) {
      const result = await setRinger(wish.ringer);
      if (!result.applied) return false;
      record(result, wish.ringer);
      changed = true;
    }
  } catch {
    return false;
  }
  if (changed && entry === generation) {
    useToast().info(i18n.global.t("prayerQuiet.applied"));
  }
  return true;
}

async function openPanel(entry: number): Promise<void> {
  const { state, stop } = await watchQuietState(onState);
  if (!state || entry !== generation) {
    stop();
    return;
  }
  stopWatching = stop;
  prayerQuiet.state = state;
  prayerQuiet.hint = null;
  prayerQuiet.open = true;
}

/**
 * The tefila is left. After a short grace (another one may open), the phone
 * goes back to how it was before the prayer.
 */
export function leavePrayer(): void {
  if (!inPrayer) return;
  inPrayer = false;
  generation++;
  if (!session) return;
  clearTimeout(revertTimer);
  revertTimer = setTimeout(() => {
    revertTimer = undefined;
    void endPrayer();
  }, LEAVE_GRACE_MS);
}

async function endPrayer(): Promise<void> {
  const ended = session;
  session = null;
  sessionStore.clear();
  if (ended) await setBack(ended);
}

/**
 * Undoes what the prayer changed, and only that: a setting the user has
 * changed again in the meantime (from the quick settings) is theirs, and
 * stays.
 */
async function setBack({ before, set }: PrayerSession): Promise<void> {
  if (set.dnd === undefined && set.ringer === undefined) return;
  const state = await readQuietState();
  if (!state) return;
  try {
    if (set.dnd !== undefined && state.dnd === set.dnd) await setDnd(before.dnd);
    if (set.ringer !== undefined && state.ringer === set.ringer) await setRinger(before.ringer);
  } catch {
    // Binary without the method: nothing more can be done from here.
  }
}

/**
 * At launch: a tefila left by closing the app sets the phone back, unless
 * the app reopens on a tefila (enterPrayer then takes it over).
 */
export async function settleLeftoverPrayer(): Promise<void> {
  if (!quietModesSupported || inPrayer || session) return;
  const leftover = sessionStore.read() ?? (await sessionStore.restore());
  if (!leftover || inPrayer || session) return;
  sessionStore.clear();
  await setBack(leftover);
}

/**
 * The panel's choices, before it closes: « Ne plus afficher la prochaine
 * fois » ("Don't show it next time", offered once « Fermer » is touched)
 * stops offering the panel;
 * « À chaque tefila » ("Every tefila") applies the modes that are on to the
 * next ones. Each time, the phone is set back once this tefila is left.
 */
export function choosePrayerQuiet(action: "never" | "always"): void {
  if (action === "never") setPrayerQuietChoice({ mode: "never", wish: choice.value.wish });
  if (action === "always" && prayerQuiet.state) {
    const { dnd, ringer } = prayerQuiet.state;
    setPrayerQuietChoice({
      mode: "always",
      wish: { dnd, ringer: ringer === "normal" ? null : ringer },
    });
  }
}

/** Closes the panel (once it has gone back up, see PrayerQuietPanel). */
export function closePrayerQuiet(): void {
  if (!prayerQuiet.open) return;
  prayerQuiet.open = false;
  prayerQuiet.hint = null;
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

/** A tile touched: the phone's mode is changed, or its access asked for. */
export async function toggleQuietMode(mode: QuietMode, on: boolean): Promise<void> {
  if (busy.has(mode)) return;
  busy.add(mode);
  try {
    const result = await setQuietMode(mode, on);
    prayerQuiet.state = { dnd: result.dnd, ringer: result.ringer, access: result.access };
    if (result.applied) record(result, mode);
    if (result.applied || result.access) return;
    // Refused for lack of access: the system list where it is granted,
    // opened by this tap (docs/design.md, « A permission is requested after
    // a gesture, never in the background »).
    pending = { mode, on };
    prayerQuiet.hint = (await openQuietAccessSettings()) ? "access" : "unavailable";
    if (prayerQuiet.hint === "unavailable") pending = null;
  } catch {
    // Binary without the method: the tile keeps showing the phone's state.
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
  clearTimeout(revertTimer);
  revertTimer = undefined;
  session = null;
  sessionStore.clear();
  inPrayer = false;
  generation = 0;
  pending = null;
  busy.clear();
  choice.value = DEFAULT_CHOICE;
  choiceRestored = true;
  prayerQuiet.open = false;
  prayerQuiet.state = null;
  prayerQuiet.hint = null;
  appDrop.held = false;
  appDrop.offset = 0;
  appDrop.scrollY = 0;
  appDrop.dragging = false;
}
