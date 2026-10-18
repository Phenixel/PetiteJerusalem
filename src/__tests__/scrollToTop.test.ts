import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";

/**
 * The back-to-top button only shows where going back up takes effort: not on
 * a page with less than two screens to scroll back, and not on the routes
 * that opt out (`meta: { scrollToTop: false }`: home page, sign-in, forms,
 * profile and settings, message threads). See docs/design.md, "Back to top,
 * only where the way back is long".
 */

vi.mock("../composables/useNativeApp", () => ({ isNativeApp: false, appPlatform: "web" }));
vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn() },
}));
// The routes bring in the home page, whose rendering probe reads a canvas
// that jsdom does not draw.
HTMLCanvasElement.prototype.getContext = (() =>
  null) as typeof HTMLCanvasElement.prototype.getContext;

import fr from "../locales/fr";
import ScrollToTop from "../components/ScrollToTop.vue";
import routes from "../router/routes";

const VIEWPORT = 800;
let scrollY = 0;
let docHeight = 0;

function stubPage(height: number) {
  scrollY = 0;
  docHeight = height;
  Object.defineProperty(window, "scrollY", { get: () => scrollY, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: VIEWPORT, configurable: true });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    get: () => docHeight,
    configurable: true,
  });
}

async function frames() {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await nextTick();
}

let app: App | null = null;
let host: HTMLElement;

async function mountAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/accueil", component: { render: () => null }, meta: { scrollToTop: false } },
      { path: "/:chemin(.*)*", component: { render: () => null } },
    ],
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  app = createApp({ render: () => h(ScrollToTop) });
  app.use(createI18n({ legacy: false, locale: "fr", messages: { fr } })).use(router);
  await router.push(path);
  await router.isReady();
  app.mount(host);
  await frames();
}

async function scrollDown(top: number) {
  scrollY = top;
  window.dispatchEvent(new Event("scroll"));
  await frames();
}

const button = () => host.querySelector(`button[aria-label="${fr.textReading.navTop}"]`);

afterEach(() => {
  app?.unmount();
  app = null;
  host?.remove();
});

describe("bouton de remontée", () => {
  it("paraît en défilant une page longue", async () => {
    stubPage(VIEWPORT * 6);
    await mountAt("/chiourim");
    await scrollDown(1600);
    expect(button()).not.toBeNull();
  });

  it("ne paraît pas sur une page courte, qu'un geste suffit à remonter", async () => {
    // Moins de deux écrans à remonter.
    stubPage(VIEWPORT * 2.5);
    await mountAt("/chiourim");
    await scrollDown(1100);
    expect(button()).toBeNull();
  });

  it("ne paraît pas sur une page qui s'en passe, même longue", async () => {
    stubPage(VIEWPORT * 6);
    await mountAt("/accueil");
    await scrollDown(1600);
    expect(button()).toBeNull();
  });
});

describe("pages sans bouton de remontée", () => {
  /** Every route record, children included, by name. */
  const byName = new Map<string, { meta?: Record<string, unknown> }>();
  const walk = (list: typeof routes) => {
    for (const route of list) {
      if (route.name) byName.set(String(route.name), route as { meta?: Record<string, unknown> });
      if ("children" in route && route.children) walk(route.children as typeof routes);
    }
  };
  walk(routes);

  it.each([
    "home",
    "login",
    "profile",
    "new-session",
    "parcours-new",
    "parcours-objective-settings",
    "support",
    "support-thread",
    "announcement-poll",
    "admin-chiour-edit",
    "admin-announcement-edit",
    "admin-support-thread",
    "not-found",
  ])("%s s'en passe", (name) => {
    expect(byName.get(name)?.meta?.scrollToTop).toBe(false);
  });

  it("le garde sur les pages longues à lire", () => {
    for (const name of ["chiourim", "study", "confidentialite", "zmanim", "calendar"]) {
      expect(byName.get(name)?.meta?.scrollToTop).not.toBe(false);
    }
  });

  it("l'enlève aussi de l'accueil traduit", () => {
    expect(byName.get("home-en")?.meta?.scrollToTop).toBe(false);
    expect(byName.get("home-he")?.meta?.scrollToTop).toBe(false);
  });
});
