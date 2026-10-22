import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, nextTick, reactive } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";

/**
 * When a tefila opens, the phone's quiet modes come down from the top of
 * the screen and push the app down (usePrayerQuiet, PrayerQuietPanel.vue,
 * PjQuietPlugin.java):
 *  - the native side: the plugin is registered and its permission declared,
 *    without which the app is not even listed under Do Not Disturb access;
 *  - the panel only opens in the Android app, with a plugin that answers;
 *  - what is changed is changed for the prayer: once the tefila is left, the
 *    phone goes back to how it was, except what the user changed again
 *    themselves; Min'ha then Arvit is one prayer; an app closed in the
 *    middle sets the phone back at the next launch;
 *  - the panel stays open until « Fermer », and comes back with the tefila
 *    (reopened, back from another app) as long as it was not touched;
 *  - in the settings, which modes and whether the panel shows are two
 *    independent settings, like the panel's choices;
 *  - « Ne plus afficher la prochaine fois » stops the panel, « À chaque
 *    tefila » applies the modes on to the next ones without asking, and
 *    the panel still comes as a reminder of them until it is told not to;
 *  - a change refused for lack of access opens the system list, and is made
 *    on return once the access is granted;
 *  - the panel comes down from above the screen with the app, grows by its
 *    choices after a moment, and retracts upward when one is made, and
 *    only then; the app below stays in use (no hold, no inert), as on a
 *    split screen.
 */

type State = { dnd: boolean; ringer: "normal" | "vibrate" | "silent"; access: boolean };

const platform = vi.hoisted(() => ({ native: true, name: "android" }));
const phone = vi.hoisted(() => ({
  state: { dnd: false, ringer: "normal", access: false } as State,
  listener: null as ((state: State) => void) | null,
  missing: false,
  settings: true,
}));
const plugin = vi.hoisted(() => ({
  start: vi.fn(),
  getState: vi.fn(),
  stop: vi.fn(() => Promise.resolve()),
  setDnd: vi.fn(),
  setRinger: vi.fn(),
  openAccessSettings: vi.fn(),
}));
const toast = vi.hoisted(() => vi.fn());

vi.mock("../composables/useNativeApp", () => ({
  get isNativeApp() {
    return platform.native;
  },
  get appPlatform() {
    return platform.name;
  },
}));

vi.mock("@capacitor/core", () => ({
  registerPlugin: () => ({
    start: plugin.start,
    getState: plugin.getState,
    stop: plugin.stop,
    setDnd: plugin.setDnd,
    setRinger: plugin.setRinger,
    openAccessSettings: plugin.openAccessSettings,
    addListener: (_event: string, listener: (state: State) => void) => {
      phone.listener = listener;
      return Promise.resolve({ remove: () => Promise.resolve() });
    },
  }),
}));

// The first-opening introduction, which the panel waits for.
const onboarding = vi.hoisted(() => ({ open: false }));
vi.mock("../composables/useOnboarding", () => ({
  isOnboardingOpen: {
    get value() {
      return onboarding.open;
    },
  },
}));

vi.mock("../composables/useToast", () => ({ useToast: () => ({ info: toast }) }));

const route = reactive({ fullPath: "/bibliotheque/sidour/chaharit" });
vi.mock("vue-router", () => ({ useRoute: () => route }));

import { quietModesSupported } from "../services/prayerQuiet";
import {
  appDrop,
  choosePrayerQuiet,
  closePrayerQuiet,
  dismissPrayerQuiet,
  enterPrayer,
  LEAVE_GRACE_MS,
  leavePrayer,
  prayerQuiet,
  prayerQuietChoice,
  resetPrayerQuiet,
  settleLeftoverPrayer,
  toggleQuietMode,
} from "../composables/usePrayerQuiet";
import { pushOverlay, resetOverlayStack } from "../composables/useOverlayStack";
import PrayerQuietPanel from "../components/PrayerQuietPanel.vue";
import ReadingSettings from "../components/settings/ReadingSettings.vue";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function applyRinger(mode: State["ringer"]): State & { applied: boolean } {
  // Like Android: leaving or entering silent needs the access.
  const touchesSilent = mode === "silent" || phone.state.ringer === "silent";
  if (touchesSilent && !phone.state.access) return { ...phone.state, applied: false };
  phone.state = { ...phone.state, ringer: mode };
  return { ...phone.state, applied: true };
}

/** The tefila left, and the grace after it run out. */
async function leaveAndWait(): Promise<void> {
  leavePrayer();
  await vi.advanceTimersByTimeAsync(LEAVE_GRACE_MS);
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  resetPrayerQuiet();
  resetOverlayStack();
  plugin.stop.mockClear();
  toast.mockClear();
  platform.native = true;
  platform.name = "android";
  phone.state = { dnd: false, ringer: "normal", access: true };
  phone.listener = null;
  phone.missing = false;
  phone.settings = true;
  onboarding.open = false;
  const answer = () =>
    phone.missing
      ? Promise.reject(new Error('"PjQuiet" plugin is not implemented on android'))
      : Promise.resolve({ ...phone.state });
  plugin.start.mockReset().mockImplementation(answer);
  plugin.getState.mockReset().mockImplementation(answer);
  plugin.setRinger
    .mockReset()
    .mockImplementation(({ mode }: { mode: State["ringer"] }) =>
      Promise.resolve(applyRinger(mode)),
    );
  plugin.setDnd.mockReset().mockImplementation(({ on }: { on: boolean }) => {
    if (!phone.state.access) return Promise.resolve({ ...phone.state, applied: false });
    phone.state = { ...phone.state, dnd: on };
    return Promise.resolve({ ...phone.state, applied: true });
  });
  plugin.openAccessSettings
    .mockReset()
    .mockImplementation(() => Promise.resolve({ opened: phone.settings }));
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("the native side of the quiet modes", () => {
  const setup = readFileSync(join(root, "scripts/setup-android.mjs"), "utf8");
  const java = readFileSync(
    join(root, "native/android/app/src/main/java/fr/petitejerusalem/app/PjQuietPlugin.java"),
    "utf8",
  );
  const bridge = readFileSync(join(root, "src/services/prayerQuiet.ts"), "utf8");

  it("declares ACCESS_NOTIFICATION_POLICY, without which Do Not Disturb cannot be set", () => {
    const start = setup.indexOf("const PERMISSIONS = [");
    const block = setup.slice(start, setup.indexOf("\n];", start));
    expect(block).toContain('name: "android.permission.ACCESS_NOTIFICATION_POLICY"');
  });

  it("registers the plugin in MainActivity, under the name the page asks for", () => {
    expect(setup).toContain("registerPlugin(PjQuietPlugin.class);");
    expect(java).toContain('@CapacitorPlugin(name = "PjQuiet")');
    expect(bridge).toContain('registerPlugin<PjQuietBridge>("PjQuiet")');
  });

  it("is Android only (iOS gives no access to the silent switch or Focus)", () => {
    // The flag is computed at load, from the platform of the mock.
    expect(quietModesSupported).toBe(true);
    expect(bridge).toMatch(/quietModesSupported = isNativeApp && appPlatform === "android"/);
  });
});

describe("offering the quiet modes when a tefila opens", () => {
  it("opens with the phone's state, already on or not, and follows it", async () => {
    phone.state = { dnd: true, ringer: "vibrate", access: true };
    await enterPrayer();
    expect(prayerQuiet.open).toBe(true);
    expect(prayerQuiet.state).toEqual({ dnd: true, ringer: "vibrate", access: true });
    phone.listener?.({ dnd: false, ringer: "silent", access: true });
    expect(prayerQuiet.state?.ringer).toBe("silent");
    closePrayerQuiet();
    expect(plugin.stop).toHaveBeenCalledTimes(1);
  });

  it("stays closed on a binary older than the plugin", async () => {
    phone.missing = true;
    await enterPrayer();
    expect(prayerQuiet.open).toBe(false);
  });

  it("does not open over another window, nor over the introduction", async () => {
    onboarding.open = true;
    await enterPrayer();
    expect(prayerQuiet.open).toBe(false);
    await leaveAndWait();
    onboarding.open = false;
    pushOverlay(() => {});
    await enterPrayer();
    expect(prayerQuiet.open).toBe(false);
  });
});

describe("the phone set for the prayer, and back after it", () => {
  it("leaving the tefila turns Do Not Disturb off again, and the ringer back", async () => {
    await enterPrayer();
    await toggleQuietMode("dnd", true);
    await toggleQuietMode("vibrate", true);
    closePrayerQuiet();
    expect(phone.state).toMatchObject({ dnd: true, ringer: "vibrate" });

    leavePrayer();
    // Not right away: another tefila may open.
    await vi.advanceTimersByTimeAsync(LEAVE_GRACE_MS - 100);
    expect(phone.state.dnd).toBe(true);
    await vi.advanceTimersByTimeAsync(100);
    expect(phone.state).toMatchObject({ dnd: false, ringer: "normal" });
  });

  it("leaves alone what was already on before the prayer", async () => {
    phone.state = { dnd: true, ringer: "normal", access: true };
    await enterPrayer();
    await toggleQuietMode("silent", true);
    closePrayerQuiet();
    await leaveAndWait();
    expect(phone.state).toMatchObject({ dnd: true, ringer: "normal" });
    expect(plugin.setDnd).not.toHaveBeenCalled();
  });

  it("leaves alone what the user changed again in the meantime", async () => {
    await enterPrayer();
    await toggleQuietMode("vibrate", true);
    closePrayerQuiet();
    phone.state = { ...phone.state, ringer: "silent" }; // from the quick settings
    plugin.setRinger.mockClear();
    await leaveAndWait();
    expect(plugin.setRinger).not.toHaveBeenCalled();
    expect(phone.state.ringer).toBe("silent");
  });

  it("Min'ha then Arvit is one prayer: no second panel once closed, set back after the last", async () => {
    await enterPrayer();
    await toggleQuietMode("dnd", true);
    dismissPrayerQuiet();
    closePrayerQuiet();
    leavePrayer();
    await vi.advanceTimersByTimeAsync(1000);
    await enterPrayer();
    expect(prayerQuiet.open).toBe(false);
    await vi.advanceTimersByTimeAsync(LEAVE_GRACE_MS);
    expect(phone.state.dnd).toBe(true);
    await leaveAndWait();
    expect(phone.state.dnd).toBe(false);
  });

  it("the panel comes back with the tefila as long as « Fermer » was not touched", async () => {
    await enterPrayer();
    // Left with the panel still open (Android back): it goes with the page.
    closePrayerQuiet();
    leavePrayer();
    await vi.advanceTimersByTimeAsync(1000);
    await enterPrayer();
    expect(prayerQuiet.open).toBe(true);
  });

  it("back from another app, the panel not closed comes back right away", async () => {
    const remove = pushOverlay(() => {});
    await enterPrayer();
    expect(prayerQuiet.open).toBe(false); // another window held the screen
    remove();
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.waitFor(() => expect(prayerQuiet.open).toBe(true));

    // Closed on purpose: back from another app, it stays away.
    dismissPrayerQuiet();
    closePrayerQuiet();
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(prayerQuiet.open).toBe(false);
  });

  it("an app closed during the tefila sets the phone back at the next launch", async () => {
    await enterPrayer();
    await toggleQuietMode("vibrate", true);
    const saved = localStorage.getItem("pj-prayer-quiet-session");
    expect(saved).not.toBeNull();
    // The app is killed, then launched again: only the device remembers.
    resetPrayerQuiet();
    localStorage.setItem("pj-prayer-quiet-session", saved!);
    await settleLeftoverPrayer();
    expect(phone.state.ringer).toBe("normal");
    expect(localStorage.getItem("pj-prayer-quiet-session")).toBeNull();
  });
});

describe("the panel's choices", () => {
  it("« À chaque tefila » turns the same modes on by themselves the next times", async () => {
    await enterPrayer();
    await toggleQuietMode("dnd", true);
    await toggleQuietMode("vibrate", true);
    choosePrayerQuiet("always");
    closePrayerQuiet();
    expect(prayerQuietChoice.value).toEqual({
      mode: "always",
      wish: { dnd: true, ringer: "vibrate" },
      remind: true,
    });
    await leaveAndWait();
    expect(phone.state).toMatchObject({ dnd: false, ringer: "normal" });

    // Applied by themselves, and shown: the panel reminds what is on.
    await enterPrayer();
    expect(phone.state).toMatchObject({ dnd: true, ringer: "vibrate" });
    expect(prayerQuiet.open).toBe(true);
    expect(prayerQuiet.state).toMatchObject({ dnd: true, ringer: "vibrate" });
    expect(toast).not.toHaveBeenCalled();
    closePrayerQuiet();
    await leaveAndWait();
    expect(phone.state).toMatchObject({ dnd: false, ringer: "normal" });
  });

  it("« À chaque tefila » shows its reminder at every tefila, until « Ne plus afficher la prochaine fois »", async () => {
    await enterPrayer();
    await toggleQuietMode("vibrate", true);
    choosePrayerQuiet("always");
    closePrayerQuiet();
    await leaveAndWait();
    for (let i = 0; i < 2; i++) {
      await enterPrayer();
      expect(prayerQuiet.open).toBe(true);
      dismissPrayerQuiet();
      closePrayerQuiet();
      await leaveAndWait();
    }

    await enterPrayer();
    choosePrayerQuiet("never");
    closePrayerQuiet();
    // The modes keep coming by themselves; only the reminder stops.
    expect(prayerQuietChoice.value).toEqual({
      mode: "always",
      wish: { dnd: false, ringer: "vibrate" },
      remind: false,
    });
    expect(JSON.parse(localStorage.getItem("pj-prayer-quiet")!)).toMatchObject({ remind: false });
    await leaveAndWait();
    await enterPrayer();
    expect(prayerQuiet.open).toBe(false);
    expect(phone.state.ringer).toBe("vibrate");
    expect(toast).toHaveBeenCalledTimes(1);
    // Back from another app: still nothing to show.
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(prayerQuiet.open).toBe(false);
  });

  it("a choice saved before the reminder existed shows it", async () => {
    localStorage.setItem(
      "pj-prayer-quiet",
      JSON.stringify({ mode: "always", wish: { dnd: true, ringer: null } }),
    );
    vi.resetModules();
    const fresh = await import("../composables/usePrayerQuiet");
    expect(fresh.prayerQuietChoice.value).toEqual({
      mode: "always",
      wish: { dnd: true, ringer: null },
      remind: true,
    });
    // Written back without the field when it is true: an older app reads it as before.
    fresh.setPrayerQuietChoice(fresh.prayerQuietChoice.value);
    expect(JSON.parse(localStorage.getItem("pj-prayer-quiet")!)).toEqual({
      mode: "always",
      wish: { dnd: true, ringer: null },
    });
  });

  it("« À chaque tefila » falls back to the panel when the phone refuses", async () => {
    await enterPrayer();
    await toggleQuietMode("dnd", true);
    choosePrayerQuiet("always");
    closePrayerQuiet();
    await leaveAndWait();
    phone.state = { ...phone.state, access: false }; // access withdrawn since
    await enterPrayer();
    expect(prayerQuiet.open).toBe(true);
  });

  it("« Ne plus afficher la prochaine fois » stops the panel, and still sets this prayer back", async () => {
    await enterPrayer();
    await toggleQuietMode("vibrate", true);
    choosePrayerQuiet("never");
    closePrayerQuiet();
    await leaveAndWait();
    expect(phone.state.ringer).toBe("normal");
    await enterPrayer();
    expect(prayerQuiet.open).toBe(false);
    expect(phone.state.ringer).toBe("normal");
  });
});

describe("changing a mode without the access", () => {
  it("opens the system list, then makes the change on return", async () => {
    phone.state = { ...phone.state, access: false };
    await enterPrayer();
    await toggleQuietMode("silent", true);
    expect(plugin.openAccessSettings).toHaveBeenCalledTimes(1);
    expect(prayerQuiet.hint).toBe("access");
    expect(prayerQuiet.state?.ringer).toBe("normal");

    // Back from the settings, access granted: the plugin pushes the state.
    phone.state = { ...phone.state, access: true };
    phone.listener?.({ ...phone.state });
    await vi.waitFor(() => expect(prayerQuiet.state?.ringer).toBe("silent"));
    expect(prayerQuiet.hint).toBeNull();
  });

  it("says so when the phone has no Do Not Disturb access list", async () => {
    phone.state = { ...phone.state, access: false };
    phone.settings = false;
    await enterPrayer();
    await toggleQuietMode("dnd", true);
    expect(prayerQuiet.hint).toBe("unavailable");
    expect(prayerQuiet.state?.dnd).toBe(false);
  });
});

describe("the panel, from the top of the screen", () => {
  let panelHeight = 100;
  const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight")!;
  beforeEach(() => {
    panelHeight = 100;
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        return (this as HTMLElement).classList.contains("prayer-quiet") ? panelHeight : 0;
      },
    });
  });
  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight);
  });

  function button(panel: HTMLElement, label: string): HTMLButtonElement {
    const found = [...panel.querySelectorAll("button")].find((b) => b.textContent?.includes(label));
    expect(found, `button « ${label} »`).toBeDefined();
    return found!;
  }

  function mountPanel(): { unmount: () => void; panel: HTMLElement } {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
    const app = createApp(PrayerQuietPanel);
    app.use(i18n);
    app.mount(host);
    const panel = host.querySelector<HTMLElement>(".prayer-quiet")!;
    return { unmount: () => app.unmount(), panel };
  }

  it("comes down with the app, grows by its choices, and retracts upward", async () => {
    phone.state = { dnd: false, ringer: "vibrate", access: true };
    await enterPrayer();
    const { unmount, panel } = mountPanel();
    await vi.advanceTimersByTimeAsync(0);

    // Glued to the app's top edge: both down by the panel's height. The app
    // below stays in use, as on a split screen: a panel, not a modal
    // window, and what scrolls into view lands below it.
    expect(appDrop.offset).toBe(100);
    expect(panel.style.transform).toBe("translate3d(0, 0px, 0)");
    expect(panel.getAttribute("role")).toBe("region");
    expect(panel.hasAttribute("aria-modal")).toBe(false);
    expect(document.documentElement.style.scrollPaddingTop).toBe("100px");
    // The three modes, each with the phone's state.
    const tiles = [...panel.querySelectorAll<HTMLButtonElement>(".quiet-tile")];
    expect(tiles.map((tile) => tile.getAttribute("aria-pressed"))).toEqual([
      "false",
      "false",
      "true",
    ]);
    expect(tiles[2].textContent).toContain("Activé");
    expect(tiles[0].textContent).toContain("Désactivé");

    // A few seconds later, the choices: the panel grows, the app follows.
    expect(panel.textContent).not.toContain("Fermer");
    panelHeight = 140;
    await vi.advanceTimersByTimeAsync(2000);
    expect(panel.textContent).toContain("Fermer");
    expect(panel.textContent).toContain("À chaque tefila");
    expect(appDrop.offset).toBe(140);

    // « Fermer »: the content gives way to where the settings live, in the
    // same room, and stays until one of its two buttons is touched.
    button(panel, "Fermer").click();
    await nextTick();
    expect(panel.querySelector(".quiet-tile")).toBeNull();
    expect(panel.textContent).toContain("Profil, Préférences");
    expect(panel.textContent).toContain("Fermer");
    expect(panel.textContent).toContain("Ne plus afficher la prochaine fois");
    expect(panel.style.minHeight).toBe("140px");
    expect(appDrop.offset).toBe(140);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(appDrop.offset).toBe(140);
    button(panel, "Fermer").click();
    await nextTick();
    // Retracting: the app comes back up, the panel goes up above the screen.
    expect(appDrop.offset).toBe(0);
    expect(panel.style.transform).toBe("translate3d(0, -140px, 0)");
    expect(document.documentElement.style.scrollPaddingTop).toBe("");
    await vi.runAllTimersAsync();
    expect(prayerQuiet.open).toBe(false);

    unmount();
  });

  it("the app below is not held while it is open: it scrolls and takes touches", () => {
    const app = readFileSync(join(root, "src/App.vue"), "utf8");
    const template = app.slice(app.indexOf("<template>"));
    expect(template).not.toMatch(/inert/);
    expect(app).toMatch(/paddingTop: `\$\{appDrop\.offset\}px`/);
  });

  it("« À chaque tefila » shows as chosen when what is on is what is kept", async () => {
    await enterPrayer();
    await toggleQuietMode("vibrate", true);
    choosePrayerQuiet("always");
    closePrayerQuiet();
    await leaveAndWait();
    await enterPrayer();
    const { unmount, panel } = mountPanel();
    await vi.advanceTimersByTimeAsync(2000);
    expect(button(panel, "À chaque tefila").getAttribute("aria-pressed")).toBe("true");
    // Vibrate turned off for this prayer: no longer what is kept.
    panel.querySelectorAll<HTMLButtonElement>(".quiet-tile")[2].click();
    await vi.advanceTimersByTimeAsync(0);
    expect(phone.state.ringer).toBe("normal");
    expect(button(panel, "À chaque tefila").getAttribute("aria-pressed")).toBe("false");
    unmount();
  });

  it("« Fermer » again, on the message, closes it for this prayer and keeps it for the next", async () => {
    await enterPrayer();
    const { unmount, panel } = mountPanel();
    await vi.advanceTimersByTimeAsync(2000);
    button(panel, "Fermer").click();
    await nextTick();
    button(panel, "Fermer").click();
    await nextTick();
    expect(appDrop.offset).toBe(0);
    await vi.runAllTimersAsync();
    expect(prayerQuiet.open).toBe(false);
    expect(prayerQuietChoice.value.mode).toBe("offer");
    unmount();
    // Back from another app: this prayer's panel was closed on purpose.
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(prayerQuiet.open).toBe(false);
    // The next prayer offers it again.
    await leaveAndWait();
    await enterPrayer();
    expect(prayerQuiet.open).toBe(true);
  });

  it("« Ne plus afficher la prochaine fois », after « Fermer », stops the panel the next times", async () => {
    await enterPrayer();
    const { unmount, panel } = mountPanel();
    await vi.advanceTimersByTimeAsync(2000);
    button(panel, "Fermer").click();
    await nextTick();
    expect(prayerQuietChoice.value.mode).toBe("offer");
    button(panel, "Ne plus afficher la prochaine fois").click();
    await nextTick();
    expect(prayerQuietChoice.value.mode).toBe("never");
    expect(appDrop.offset).toBe(0);
    await vi.runAllTimersAsync();
    expect(prayerQuiet.open).toBe(false);
    unmount();
  });

  it("a touch on a tile turns its mode off as well as on", async () => {
    phone.state = { dnd: true, ringer: "normal", access: true };
    await enterPrayer();
    const { unmount, panel } = mountPanel();
    await vi.advanceTimersByTimeAsync(0);
    panel.querySelector<HTMLButtonElement>(".quiet-tile")!.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(phone.state.dnd).toBe(false);
    // The first touch brings the choices without waiting.
    expect(panel.textContent).toContain("Fermer");
    unmount();
  });

  it("stays open until « Fermer »: nothing closes it on its own, nor Escape", async () => {
    await enterPrayer();
    const { unmount } = mountPanel();
    await vi.advanceTimersByTimeAsync(60_000);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await vi.advanceTimersByTimeAsync(1000);
    expect(prayerQuiet.open).toBe(true);
    expect(appDrop.offset).toBe(100);
    unmount();
  });
});

describe("the settings, « Avant une tefila »", () => {
  function mountSettings(): { unmount: () => void; host: HTMLElement } {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
    const app = createApp(ReadingSettings);
    app.use(i18n);
    app.mount(host);
    return { unmount: () => app.unmount(), host };
  }
  const toggle = (host: HTMLElement) =>
    [...host.querySelectorAll<HTMLElement>("label")]
      .find((label) => label.textContent?.includes("Afficher le panneau"))!
      .querySelector<HTMLElement>("button, input")!;

  it("which modes and whether the panel shows are set apart", async () => {
    await enterPrayer();
    await toggleQuietMode("vibrate", true);
    choosePrayerQuiet("always");
    closePrayerQuiet();
    const { unmount, host } = mountSettings();
    await nextTick();
    expect(host.textContent).toContain("Les mêmes à chaque tefila (Vibreur)");

    // The panel hidden: the same modes still come by themselves.
    toggle(host).click();
    await nextTick();
    expect(prayerQuietChoice.value).toMatchObject({ mode: "always", remind: false });
    toggle(host).click();
    await nextTick();
    expect(prayerQuietChoice.value).toMatchObject({ mode: "always", remind: true });
    unmount();
  });

  it("modes chosen each time without the panel is nothing at all", async () => {
    const { unmount, host } = mountSettings();
    await nextTick();
    // Nothing kept yet: no choice of modes to make.
    expect(host.querySelector("[role=combobox]")).toBeNull();
    toggle(host).click();
    await nextTick();
    expect(prayerQuietChoice.value).toMatchObject({ mode: "never" });
    toggle(host).click();
    await nextTick();
    expect(prayerQuietChoice.value).toMatchObject({ mode: "offer", remind: true });
    unmount();
  });
});
