import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import fr from "../locales/fr";
import { HELP_GUIDES } from "../content/help/catalog";
import { HELP_VERSIONS } from "../content/help/versions";
import { parseHelpVideos } from "../services/helpVideos";

/**
 * The help center's pages (HelpCenterPage, HelpGuidePage; the content is held
 * by helpCenter.test.ts):
 * - the page opens on the "what's new" video, and its card plays it;
 * - the guides by topic; the videos only when the site lists some;
 * - a guide's page shows its blocks, and an unknown guide leads back to the
 *   help center;
 * - the frequently asked questions, closed, each opening on its answer;
 *   `/aide#compte` opens on that one;
 * - the page of a version lists the passages of its video, each opening on
 *   its questions and playing the video from its start; `#calme` opens on
 *   that passage.
 */

const { videosToShow } = vi.hoisted(() => ({ videosToShow: { value: [] as unknown[] } }));

vi.mock("../services/helpVideos", async (importOriginal) => {
  const original = await importOriginal<typeof import("../services/helpVideos")>();
  return { ...original, loadHelpVideos: async () => videosToShow.value };
});
vi.mock("../services/seoService", () => ({ seoService: { setMeta: vi.fn() } }));
vi.mock("../services/analyticsService", () => ({ analyticsService: { capture: vi.fn() } }));

async function flush() {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }
}

/** The apps mounted by a test, unmounted after it: a screenshot still loading must not land after. */
const mounted: App[] = [];

async function mount(path: string) {
  const { default: HelpCenterPage } = await import("../views/Help/HelpCenterPage.vue");
  const { default: HelpGuidePage } = await import("../views/Help/HelpGuidePage.vue");
  const { default: HelpVersionPage } = await import("../views/Help/HelpVersionPage.vue");
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/aide", name: "help", component: HelpCenterPage },
      { path: "/aide/:slug", component: HelpGuidePage },
      { path: "/aide/nouveautes/:version", name: "help-version", component: HelpVersionPage },
      { path: "/:other(.*)*", component: { render: () => null } },
    ],
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(RouterView) });
  app.use(i18n);
  app.use(router);
  await router.push(path);
  app.mount(host);
  mounted.push(app);
  await flush();
  return { host, router, text: () => host.textContent ?? "" };
}

describe("the help center page", () => {
  afterEach(() => {
    for (const app of mounted.splice(0)) app.unmount();
  });

  beforeEach(() => {
    videosToShow.value = [];
    document.body.innerHTML = "";
  });

  it("opens on the « what's new » video, whose card plays it", async () => {
    const page = await mount("/aide");
    const card = [...page.host.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Les nouveautés de la 4.0"),
    );
    expect(card).toBeDefined();
    const { isWhatsNewOpen, useWhatsNew } = await import("../composables/useWhatsNew");
    expect(isWhatsNewOpen.value).toBe(false);
    card!.click();
    expect(isWhatsNewOpen.value).toBe(true);
    expect(useWhatsNew().whatsNewSource.value).toBe("help");
    useWhatsNew().closeWhatsNew(true);
  });

  it("lists the guides by topic, and the videos only when there are some", async () => {
    let page = await mount("/aide");
    const missing = HELP_GUIDES.filter(
      (guide) => !page.host.querySelector(`a[href="/aide/${guide.slug}"]`),
    );
    expect(missing.map((guide) => guide.slug)).toEqual([]);
    expect(page.text()).toContain("Lire à plusieurs");
    expect(page.text()).not.toContain(fr.help.videos);
    expect(page.host.querySelector('a[href^="https://www.youtube.com"]')).toBeNull();

    document.body.innerHTML = "";
    videosToShow.value = parseHelpVideos({
      videos: [{ youtube: "AbCdEfGhIjK", title: { fr: "Prendre le Sidour en main" } }],
    });
    page = await mount("/aide");
    expect(page.text()).toContain(fr.help.videos);
    const link = page.host.querySelector('a[href="https://www.youtube.com/watch?v=AbCdEfGhIjK"]');
    expect(link?.textContent).toContain("Prendre le Sidour en main");
  });

  it("shows a guide's blocks, and leads an unknown guide back to the help center", async () => {
    const page = await mount("/aide/gestes-de-lecture");
    // Its drawn screenshots load with it, one per gesture shown.
    await vi.waitFor(() => expect(page.host.querySelectorAll(".capture")).toHaveLength(3));
    expect(page.host.querySelector("h1")?.textContent).toContain(fr.onboarding.gestures.title);
    expect(page.text()).toContain(fr.tips.reading.pinch.title);
    expect(page.text()).toContain(fr.tips.reading.pinch.text);

    document.body.innerHTML = "";
    const lost = await mount("/aide/une-page-qui-n-existe-pas");
    expect(lost.router.currentRoute.value.path).toBe("/aide");
  });
});

describe("the page of a version", () => {
  afterEach(() => {
    for (const app of mounted.splice(0)) app.unmount();
  });

  beforeEach(() => {
    document.body.innerHTML = "";
    Element.prototype.scrollIntoView = vi.fn();
  });

  const version = HELP_VERSIONS.find((entry) => entry.version === "4.0")!;

  it("is reached from the help center", async () => {
    const page = await mount("/aide");
    const row = page.host.querySelector('a[href="/aide/nouveautes/4.0"]');
    expect(row?.textContent).toContain("La 4.0, passage par passage");
  });

  it("lists the passages of the video, closed, each with where it starts", async () => {
    const page = await mount("/aide/nouveautes/4.0");
    expect(page.host.querySelector("h1")?.textContent).toContain("Les nouveautés de la 4.0");
    const passages = [...page.host.querySelectorAll("li.passage")];
    expect(passages.map((li) => li.id)).toEqual(version.passages.map((p) => p.chapter));
    expect(passages[0].querySelector("summary")?.textContent).toContain("0:04");
    expect(passages[0].querySelector("summary")?.textContent).toContain("Les onglets changent");
    expect(page.host.querySelectorAll("details[open]")).toHaveLength(0);
  });

  it("opens a passage on its questions, and plays the video from its start", async () => {
    const page = await mount("/aide/nouveautes/4.0");
    const details = page.host.querySelector<HTMLDetailsElement>("#calme details")!;
    details.open = true;
    details.dispatchEvent(new Event("toggle"));
    await nextTick();
    expect(details.textContent).toContain("Pourquoi n'apparaît-il pas sur iPhone");
    expect(details.querySelector('a[href="/aide/avant-la-tefila"]')).not.toBeNull();

    const play = [...details.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Revoir ce passage"),
    )!;
    expect(play.getAttribute("aria-label")).toContain("à 0:20");
    play.click();
    const { isWhatsNewOpen, useWhatsNew } = await import("../composables/useWhatsNew");
    expect(isWhatsNewOpen.value).toBe(true);
    expect(useWhatsNew().whatsNewPassage.value).toEqual({ id: "calme", start: 20 });
    useWhatsNew().closeWhatsNew(true);
  });

  it("opens on the passage its address names, and leads an unknown version back", async () => {
    const page = await mount("/aide/nouveautes/4.0#fin");
    expect(page.host.querySelector<HTMLDetailsElement>("#fin details")?.open).toBe(true);
    expect(page.host.querySelectorAll("details[open]")).toHaveLength(1);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

    document.body.innerHTML = "";
    const lost = await mount("/aide/nouveautes/9.9");
    expect(lost.router.currentRoute.value.path).toBe("/aide");
  });
});

describe("the frequently asked questions", () => {
  afterEach(() => {
    for (const app of mounted.splice(0)) app.unmount();
  });

  beforeEach(() => {
    videosToShow.value = [];
    document.body.innerHTML = "";
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("list their questions, closed, each opening on its answer", async () => {
    const page = await mount("/aide");
    expect(page.text()).toContain(fr.help.faq.title);
    const questions = page.host.querySelectorAll("li.question details");
    expect(questions.length).toBeGreaterThan(10);
    expect(page.host.querySelectorAll("li.question details[open]")).toHaveLength(0);

    const free = page.host.querySelector<HTMLDetailsElement>("#gratuite details")!;
    expect(free.querySelector("summary")?.textContent).toContain("L'app est-elle gratuite");
    free.open = true;
    free.dispatchEvent(new Event("toggle"));
    await nextTick();
    expect(free.textContent).toContain("sans publicité");
  });

  it("open on the question the address names", async () => {
    const page = await mount("/aide#compte");
    expect(page.host.querySelector<HTMLDetailsElement>("#compte details")?.open).toBe(true);
    expect(page.host.querySelectorAll("li.question details[open]")).toHaveLength(1);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
