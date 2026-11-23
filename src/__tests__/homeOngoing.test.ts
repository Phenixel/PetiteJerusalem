import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";

/**
 * « En ce moment » on the home page (HomeOngoing.vue): the moon, shown
 * above the times while it can be said, opens its text and leaves once
 * marked done.
 */

vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn() },
}));

import fr from "../locales/fr";

let mounted: App[] = [];

async function mountAt(iso: string): Promise<HTMLElement> {
  vi.setSystemTime(new Date(iso));
  const { default: HomeOngoing } = await import("../components/HomeOngoing.vue");
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:path(.*)*", component: { render: () => null } }],
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(HomeOngoing) });
  app.use(i18n).use(router);
  app.mount(host);
  mounted.push(app);
  await router.isReady();
  await nextTick();
  return host;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  for (const app of mounted) app.unmount();
  mounted = [];
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("« En ce moment » on the home page", () => {
  it("shows the moon on its last night, opens its text, and leaves once done", async () => {
    // Monday 23 November 2026, 7:30 p.m. in Paris: the last night of the moon of Kislev.
    const host = await mountAt("2026-11-23T18:30:00Z");
    expect(host.textContent).toContain(fr.home.ongoing.title);
    expect(host.textContent).toContain(fr.home.birkatHalevana.title);
    expect(host.querySelector("a")?.getAttribute("href")).toContain("birkat-halevana");
    host.querySelector<HTMLButtonElement>("button")!.click();
    await nextTick();
    expect(host.textContent?.trim()).toBe("");
    expect(localStorage.getItem("pj_parcours_occasions")).toContain("halevana:5787-9");
  });

  it("shows nothing when nothing is going on", async () => {
    const host = await mountAt("2026-11-05T10:00:00Z");
    expect(host.textContent?.trim()).toBe("");
  });
});
