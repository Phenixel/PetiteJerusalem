import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import fr from "../locales/fr";

/**
 * What's new, once, at the first opening after an update (WhatsNewTour,
 * useTabBarChange, docs/design.md "What's new plays out once, after an
 * update"). Four promises:
 *
 *  - the bottom bar opens as people knew it (Bibliothèque, Chiourim), then
 *    plays its change, and the real tabs take over at the end;
 *  - « Revoir » plays it again, the next step hands the bar back;
 *  - a fresh install never gets it: closing the first introduction records
 *    it as seen, even if the tour was already waiting under it;
 *  - nothing moves when the system asks for fewer animations.
 */

vi.mock("../composables/useNativeApp", () => ({ isNativeApp: true, appPlatform: "ios" }));
vi.mock("../services/analyticsService", () => ({ analyticsService: { capture: vi.fn() } }));
vi.mock("../services/authService", () => ({
  authService: { onAuthChanged: () => () => {} },
}));
vi.mock("@capacitor/preferences", () => ({
  Preferences: { get: () => Promise.resolve({ value: null }), set: () => Promise.resolve() },
}));

const SEEN_KEY = "pj_tips_seen";

/** The native preferences import (a real turn of the loop), then the delays. */
async function settle() {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    await vi.advanceTimersByTimeAsync(10);
    await nextTick();
  }
}

/** jsdom measures nothing: the bar gets the size of a phone's. */
function sizeBar(nav: HTMLElement) {
  nav.getBoundingClientRect = () =>
    ({ top: 788, left: 0, width: 390, height: 56, bottom: 844, right: 390 }) as DOMRect;
}

async function mountApp() {
  const { default: BottomTabBar } = await import("../components/BottomTabBar.vue");
  const { default: WhatsNewTour } = await import("../components/WhatsNewTour.vue");
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:chemin(.*)*", component: { render: () => null } }],
  });
  await router.push("/");
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({
    render: () => [h(BottomTabBar), h(WhatsNewTour, { delay: 0 })],
  });
  app.use(i18n);
  app.use(router);
  app.mount(host);
  await nextTick();
  const nav = host.querySelector<HTMLElement>('nav[data-tour="tab-bar"]');
  if (nav) sizeBar(nav);
  return { app, host };
}

const bubble = () => document.querySelector<HTMLElement>('[role="dialog"]');
const button = (label: string) =>
  Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === label) ??
  null;
const scene = () => document.querySelector<HTMLElement>(".tab-change");

function endScene() {
  const event = new Event("animationend", { bubbles: true });
  Object.defineProperty(event, "animationName", { value: "sidour-arrive-1a2b3c" });
  document.querySelector(".change-sidour")?.dispatchEvent(event);
}

describe("what's new after an update", () => {
  beforeEach(() => {
    localStorage.clear();
    // An existing user: the introduction was seen with an earlier version.
    localStorage.setItem("pj_onboarding_seen", "1");
    document.body.innerHTML = "";
    window.innerWidth = 390;
    window.innerHeight = 844;
    vi.resetModules();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  });

  it("opens on the old bar, plays the change, then hands over to the real tabs", async () => {
    const { holdTabBarChange, tabBarChange } = await import("../composables/useTabBarChange");
    // App.vue holds the bar before the first frame.
    holdTabBarChange();
    await mountApp();

    // The bar as people knew it.
    expect(scene()?.textContent).toContain(fr.study.title);
    expect(scene()?.textContent).toContain(fr.common.chiourim);
    expect(document.querySelector("nav")?.classList.contains("tabs-staged")).toBe(true);

    await settle();
    expect(bubble()?.textContent).toContain(fr.tips.whatsNew.tabs.title);
    expect(tabBarChange.value).toBe("playing");
    expect(scene()?.classList.contains("tab-change-held")).toBe(false);

    // Sidour settles: the real tabs are back, in the same place.
    endScene();
    await nextTick();
    expect(scene()).toBeNull();
    expect(document.querySelector("nav")?.classList.contains("tabs-staged")).toBe(false);

    // « Revoir » plays it again.
    button(fr.tips.whatsNew.replay)?.click();
    await nextTick();
    expect(tabBarChange.value).toBe("playing");

    // The next step hands the bar back and shows its capture.
    button(fr.tips.next)?.click();
    await nextTick();
    expect(tabBarChange.value).toBe("off");
    expect(bubble()?.textContent).toContain(fr.tips.whatsNew.parcours.title);
  });

  it("is seen once closed, and does not come back", async () => {
    await mountApp();
    await settle();
    button(fr.tips.skip)?.click();
    await nextTick();
    expect(bubble()).toBeNull();
    expect(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]")).toContain("whats-new-2026-10");

    vi.resetModules();
    document.body.innerHTML = "";
    await mountApp();
    await settle();
    expect(bubble()).toBeNull();
  });

  it("is never shown to a fresh install, even when already waiting under the introduction", async () => {
    localStorage.removeItem("pj_onboarding_seen");
    const { useOnboarding } = await import("../composables/useOnboarding");
    await mountApp();
    await settle();
    expect(bubble()).toBeNull();

    useOnboarding().completeOnboarding();
    await settle();
    expect(bubble()).toBeNull();
    expect(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]")).toContain("whats-new-2026-10");
  });

  it("stays due when the introduction is only replayed", async () => {
    const { useOnboarding } = await import("../composables/useOnboarding");
    const onboarding = useOnboarding();
    onboarding.replayOnboarding();
    onboarding.completeOnboarding();
    expect(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]")).not.toContain("whats-new-2026-10");
  });

  it("lets go of the held bar when the tour is not due", async () => {
    localStorage.setItem(SEEN_KEY, JSON.stringify(["whats-new-2026-10"]));
    const { holdTabBarChange, tabBarChange } = await import("../composables/useTabBarChange");
    holdTabBarChange();
    await mountApp();
    await settle();
    expect(tabBarChange.value).toBe("off");
    expect(bubble()).toBeNull();
  });

  it("does not move when the system asks for fewer animations", async () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduce"),
    })) as unknown as typeof window.matchMedia;
    try {
      const { holdTabBarChange, playTabBarChange, tabBarChange } = await import(
        "../composables/useTabBarChange"
      );
      holdTabBarChange();
      playTabBarChange();
      expect(tabBarChange.value).toBe("off");
    } finally {
      window.matchMedia = matchMedia;
    }
  });
});
