import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, nextTick, reactive } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";

/**
 * When a tefila opens, the app goes down and the phone's quiet modes open
 * above it (usePrayerQuiet, PrayerQuietPanel.vue, PjQuietPlugin.java):
 *  - the native side: the plugin is registered and its permission declared,
 *    without which the app is not even listed under Do Not Disturb access;
 *  - the panel only opens in the Android app, with a plugin that answers,
 *    and not again right after it was closed;
 *  - a change refused for lack of access opens the system list, and is made
 *    on return once the access is granted;
 *  - the app goes down by the panel's height and comes back up where it was.
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
  stop: vi.fn(() => Promise.resolve()),
  setDnd: vi.fn(),
  setRinger: vi.fn(),
  openAccessSettings: vi.fn(),
}));

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

const route = reactive({ fullPath: "/bibliotheque/sidour/chaharit" });
vi.mock("vue-router", () => ({ useRoute: () => route }));

import { quietModesSupported } from "../services/prayerQuiet";
import {
  appDrop,
  closePrayerQuiet,
  offerPrayerQuiet,
  prayerQuiet,
  REOFFER_AFTER_MS,
  resetPrayerQuiet,
  toggleQuietMode,
} from "../composables/usePrayerQuiet";
import { pushOverlay, resetOverlayStack } from "../composables/useOverlayStack";
import PrayerQuietPanel from "../components/PrayerQuietPanel.vue";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function applyRinger(mode: State["ringer"]): State & { applied: boolean } {
  // Like Android: leaving or entering silent needs the access.
  const touchesSilent = mode === "silent" || phone.state.ringer === "silent";
  if (touchesSilent && !phone.state.access) return { ...phone.state, applied: false };
  phone.state = { ...phone.state, ringer: mode };
  return { ...phone.state, applied: true };
}

beforeEach(() => {
  resetPrayerQuiet();
  resetOverlayStack();
  plugin.stop.mockClear();
  platform.native = true;
  platform.name = "android";
  phone.state = { dnd: false, ringer: "normal", access: false };
  phone.listener = null;
  phone.missing = false;
  phone.settings = true;
  onboarding.open = false;
  plugin.start
    .mockReset()
    .mockImplementation(() =>
      phone.missing
        ? Promise.reject(new Error('"PjQuiet" plugin is not implemented on android'))
        : Promise.resolve({ ...phone.state }),
    );
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
});

describe("offering the quiet modes when a tefila opens", () => {
  it("opens in the Android app, with the phone's state", async () => {
    phone.state = { dnd: true, ringer: "vibrate", access: true };
    expect(await offerPrayerQuiet()).toBe(true);
    expect(prayerQuiet.open).toBe(true);
    expect(prayerQuiet.state).toEqual({ dnd: true, ringer: "vibrate", access: true });
  });

  it("follows the phone while it is open, and lets go once closed", async () => {
    await offerPrayerQuiet();
    phone.listener?.({ dnd: false, ringer: "silent", access: false });
    expect(prayerQuiet.state?.ringer).toBe("silent");
    closePrayerQuiet();
    expect(plugin.stop).toHaveBeenCalledTimes(1);
  });

  it("stays closed on a binary older than the plugin", async () => {
    phone.missing = true;
    expect(await offerPrayerQuiet()).toBe(false);
    expect(prayerQuiet.open).toBe(false);
  });

  it("stays closed outside the Android app (iOS gives no access to these modes)", () => {
    // The flag is computed at load, from the platform of the mock.
    expect(quietModesSupported).toBe(true);
    const source = readFileSync(join(root, "src/services/prayerQuiet.ts"), "utf8");
    expect(source).toMatch(/quietModesSupported = isNativeApp && appPlatform === "android"/);
  });

  it("does not open over another window, nor over the introduction", async () => {
    onboarding.open = true;
    expect(await offerPrayerQuiet()).toBe(false);
    onboarding.open = false;
    pushOverlay(() => {});
    expect(await offerPrayerQuiet()).toBe(false);
  });

  it("does not come back right after it was closed (Min'ha then Arvit)", async () => {
    await offerPrayerQuiet(0);
    closePrayerQuiet(1_000);
    expect(await offerPrayerQuiet(1_000 + 60_000)).toBe(false);
    expect(await offerPrayerQuiet(1_000 + REOFFER_AFTER_MS)).toBe(true);
  });
});

describe("changing a mode from the panel", () => {
  it("vibrate needs no access, and replaces the normal ringer", async () => {
    await offerPrayerQuiet();
    await toggleQuietMode("vibrate", true);
    expect(prayerQuiet.state?.ringer).toBe("vibrate");
    expect(plugin.openAccessSettings).not.toHaveBeenCalled();
    await toggleQuietMode("vibrate", false);
    expect(prayerQuiet.state?.ringer).toBe("normal");
  });

  it("without access, opens the system list, then makes the change on return", async () => {
    await offerPrayerQuiet();
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
    phone.settings = false;
    await offerPrayerQuiet();
    await toggleQuietMode("dnd", true);
    expect(prayerQuiet.hint).toBe("unavailable");
    expect(prayerQuiet.state?.dnd).toBe(false);
  });
});

describe("the app lowered under the panel", () => {
  /** jsdom has no PointerEvent: a mouse event under its name, with an id. */
  function pointer(type: string, clientY: number): Event {
    const event = new MouseEvent(type, { clientY, bubbles: true });
    Object.defineProperty(event, "pointerId", { value: 1 });
    return event;
  }

  function mountPanel(): { unmount: () => void; panel: HTMLElement } {
    const stage = document.createElement("div");
    stage.id = "app-stage";
    document.body.appendChild(stage);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
    const app = createApp(PrayerQuietPanel);
    app.use(i18n);
    app.mount(host);
    const panel = host.querySelector<HTMLElement>(".prayer-quiet")!;
    return { unmount: () => app.unmount(), panel };
  }

  it("goes down by the panel's height, then comes back up where it was", async () => {
    vi.useFakeTimers();
    const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight")!;
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        return (this as HTMLElement).classList.contains("prayer-quiet") ? 320 : 0;
      },
    });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    Object.defineProperty(window, "scrollY", { configurable: true, value: 140 });
    phone.state = { dnd: false, ringer: "vibrate", access: true };
    await offerPrayerQuiet();
    const { unmount, panel } = mountPanel();
    await nextTick();
    await nextTick();

    expect(appDrop.held).toBe(true);
    expect(appDrop.scrollY).toBe(140);
    expect(appDrop.offset).toBe(320);
    // The three modes, each with the phone's state.
    const states = [...panel.querySelectorAll("label")].map((row) => row.textContent);
    expect(states[0]).toContain("Désactivé");
    expect(states[1]).toContain("Désactivé");
    expect(states[2]).toContain("Activé");

    panel.querySelector<HTMLButtonElement>(".btn-primary")!.click();
    expect(appDrop.offset).toBe(0);
    expect(prayerQuiet.open).toBe(true);
    await vi.runAllTimersAsync();
    expect(prayerQuiet.open).toBe(false);
    expect(appDrop.held).toBe(false);
    expect(scrollTo).toHaveBeenCalledWith({ top: 140, behavior: "instant" });

    unmount();
    scrollTo.mockRestore();
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight);
  });

  it("a tap on the lowered app closes it", async () => {
    vi.useFakeTimers();
    await offerPrayerQuiet();
    const { unmount } = mountPanel();
    await nextTick();
    const catcher = document.querySelector<HTMLButtonElement>("#app-stage .prayer-quiet-catcher")!;
    expect(catcher).not.toBeNull();
    catcher.dispatchEvent(pointer("pointerdown", 500));
    catcher.dispatchEvent(pointer("pointerup", 501));
    await vi.runAllTimersAsync();
    expect(prayerQuiet.open).toBe(false);
    unmount();
  });
});
