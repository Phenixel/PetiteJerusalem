import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, effectScope, h, nextTick, ref, type App } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";

/**
 * The back-to-top button is the exception: it only shows on the routes that
 * ask for it (`meta: { scrollToTop: true }`: the texts of a session or of a
 * library section, the chapters of a book, the audio classes), and only once
 * the top is more than three screens away. See docs/design.md, "Back to top,
 * only on long lists".
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
import { requestScrollToTop } from "../composables/useScrollToTop";

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
      { path: "/chiourim", component: { render: () => null }, meta: { scrollToTop: true } },
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
  it("paraît sur une liste longue, à plus de trois écrans du haut", async () => {
    stubPage(VIEWPORT * 10);
    await mountAt("/chiourim");
    await scrollDown(VIEWPORT * 3 + 100);
    expect(button()).not.toBeNull();
  });

  it("attend d'être à plus de trois écrans du haut", async () => {
    stubPage(VIEWPORT * 10);
    await mountAt("/chiourim");
    await scrollDown(VIEWPORT * 2.5);
    expect(button()).toBeNull();
  });

  it("paraît le temps qu'une page le demande (la bibliothèque en recherche)", async () => {
    stubPage(VIEWPORT * 10);
    await mountAt("/bibliotheque");
    const searching = ref(true);
    const scope = effectScope();
    scope.run(() => requestScrollToTop(() => searching.value));
    await scrollDown(VIEWPORT * 4);
    expect(button()).not.toBeNull();

    // Search cleared: the next scroll no longer shows it.
    searching.value = false;
    await nextTick();
    await scrollDown(VIEWPORT * 5);
    // Its leaving transition takes a frame more.
    await frames();
    expect(button()).toBeNull();
    scope.stop();
  });

  it("ne paraît pas sur une page qui ne le demande pas, même longue", async () => {
    stubPage(VIEWPORT * 10);
    await mountAt("/profile");
    await scrollDown(VIEWPORT * 5);
    expect(button()).toBeNull();
  });
});

describe("pages avec bouton de remontée", () => {
  /** Every route record, children included, by name. */
  const byName = new Map<string, { meta?: Record<string, unknown> }>();
  const walk = (list: typeof routes) => {
    for (const route of list) {
      if (route.name) byName.set(String(route.name), route as { meta?: Record<string, unknown> });
      if ("children" in route && route.children) walk(route.children as typeof routes);
    }
  };
  walk(routes);

  /** The opted-in pages: adding one is a decision, written in docs/design.md. */
  const WITH_BUTTON = [
    "detail-session",
    "study-corpus",
    "etude-reading",
    "etude-reading-section",
    "text-reading",
    "text-reading-section",
    "chiourim",
    "auteur-chiourim",
    "serie-chiourim",
    "detail-chiour",
    "announcements",
  ];

  it("ne le propose qu'aux longues listes choisies", () => {
    const opted = [...byName].filter(([, r]) => r.meta?.scrollToTop === true).map(([n]) => n);
    expect(opted.sort()).toEqual([...WITH_BUTTON].sort());
  });
});
