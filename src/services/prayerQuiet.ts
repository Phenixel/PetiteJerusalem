import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { appPlatform, isNativeApp } from "../composables/useNativeApp";

/**
 * The phone's quiet modes (Do Not Disturb, silent, vibrate), offered when a
 * tefila opens (PrayerQuietPanel.vue), through the in-house PjQuiet plugin
 * (native/android/, PjQuietPlugin.java).
 *
 * Android only: it lets an app read the three states and, with the
 * "Do Not Disturb access" the user grants in the settings, change them. iOS
 * gives an app neither (no public API for the ring/silent switch or for
 * Focus), and the web even less: the panel is not offered there.
 */

export type RingerMode = "normal" | "vibrate" | "silent";

export interface QuietState {
  /** Do Not Disturb is on, whatever its filter and whoever set it. */
  dnd: boolean;
  ringer: RingerMode;
  /** The app may change Do Not Disturb (and silent, which toggles it). */
  access: boolean;
}

/** One of the three rows of the panel. */
export type QuietMode = "dnd" | "silent" | "vibrate";

interface QuietResult extends QuietState {
  /** The system made the change. */
  applied: boolean;
}

interface PjQuietBridge {
  getState(): Promise<QuietState>;
  /** Follows the state (the "change" event) and returns it. */
  start(): Promise<QuietState>;
  stop(): Promise<void>;
  setDnd(options: { on: boolean }): Promise<QuietResult>;
  setRinger(options: { mode: RingerMode }): Promise<QuietResult>;
  /** The system list of Do Not Disturb access; false when the phone has none. */
  openAccessSettings(): Promise<{ opened: boolean }>;
  addListener(
    event: "change",
    listener: (state: QuietState) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
}

const PjQuiet = registerPlugin<PjQuietBridge>("PjQuiet");

/** Where the panel can be offered at all. */
export const quietModesSupported = isNativeApp && appPlatform === "android";

/** Whether a row is on, read from the phone's state. */
export function isQuietModeOn(state: QuietState, mode: QuietMode): boolean {
  if (mode === "dnd") return state.dnd;
  return state.ringer === mode;
}

/** Do Not Disturb on ("priority only") or off. */
export async function setDnd(on: boolean): Promise<QuietResult> {
  return PjQuiet.setDnd({ on });
}

/** The ringer: normal, vibrate or silent. */
export async function setRinger(mode: RingerMode): Promise<QuietResult> {
  return PjQuiet.setRinger({ mode });
}

/**
 * Turns a row on or off. Silent and vibrate are the two ends of the same
 * ringer: turning one on replaces the other, turning it off goes back to the
 * normal ringer.
 */
export async function setQuietMode(mode: QuietMode, on: boolean): Promise<QuietResult> {
  if (mode === "dnd") return setDnd(on);
  return setRinger(on ? mode : "normal");
}

/** The phone's state, once; null outside the Android app or without the plugin. */
export async function readQuietState(): Promise<QuietState | null> {
  if (!quietModesSupported) return null;
  try {
    const { dnd, ringer, access } = await PjQuiet.getState();
    return { dnd, ringer, access };
  } catch {
    return null;
  }
}

/** Opens the Do Not Disturb access list; false when the phone has none. */
export async function openQuietAccessSettings(): Promise<boolean> {
  try {
    const { opened } = await PjQuiet.openAccessSettings();
    return opened;
  } catch {
    return false;
  }
}

/**
 * Follows the phone's state while the panel is open; resolves with the
 * current one, or null on a binary older than the plugin (the panel then
 * stays closed). Returns, with it, the function that stops following.
 */
export async function watchQuietState(
  onChange: (state: QuietState) => void,
): Promise<{ state: QuietState | null; stop: () => void }> {
  if (!quietModesSupported) return { state: null, stop: () => {} };
  let stopped = false;
  let handle: PluginListenerHandle | null = null;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    void handle?.remove();
    try {
      PjQuiet.stop().catch(() => {});
    } catch {
      // Binary without the plugin.
    }
  };
  try {
    // The plugin never goes through a promise (docs/app-native.md, « A
    // plugin never goes through a promise »): only the listener's handle
    // and the state come out of one.
    PjQuiet.addListener("change", (state) => {
      if (!stopped) onChange(state);
    }).then(
      (listener) => {
        if (stopped) void listener.remove();
        else handle = listener;
      },
      () => {},
    );
    const state = await PjQuiet.start();
    return { state, stop };
  } catch {
    stop();
    return { state: null, stop };
  }
}
