import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The "what's new" video (useWhatsNew, WhatsNewVideo.vue).
 *
 * Three promises: it plays once after an update, never on a fresh install
 * (the introduction is there for that), and only in the app; and the video it
 * asks the site for exists, in each language, under the name the code reads.
 * And one leaves it at any time: « Passer » when it came on its own, « Fermer »
 * when the help center's card asked for it. The page of the version plays
 * it from one of its passages, and the end of the video leads there
 * (« En savoir plus »).
 */

vi.mock("../composables/useNativeApp", () => ({ isNativeApp: true, appPlatform: "ios" }));

const SEEN_KEY = "pj_whats_new_seen";
const ONBOARDING_KEY = "pj_onboarding_seen";

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("launchDecision", () => {
  it("plays after an update, when the video has not been seen", async () => {
    const { launchDecision } = await import("../composables/useWhatsNew");
    expect(launchDecision({ native: true, seen: null, onboardingSeen: "1" })).toBe("play");
    expect(launchDecision({ native: true, seen: "3.9", onboardingSeen: "1" })).toBe("play");
  });

  it("does not play on a fresh install, and notes it as seen", async () => {
    const { launchDecision } = await import("../composables/useWhatsNew");
    expect(launchDecision({ native: true, seen: null, onboardingSeen: null })).toBe("mark");
  });

  it("plays only once, and never on the site", async () => {
    const { launchDecision, WHATS_NEW_VERSION } = await import("../composables/useWhatsNew");
    expect(launchDecision({ native: true, seen: WHATS_NEW_VERSION, onboardingSeen: "1" })).toBe(
      "skip",
    );
    expect(launchDecision({ native: false, seen: null, onboardingSeen: "1" })).toBe("skip");
  });
});

describe("at launch", () => {
  it("opens for a device that had the app before", async () => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    const { isWhatsNewOpen, useWhatsNew } = await import("../composables/useWhatsNew");
    await vi.waitFor(() => expect(isWhatsNewOpen.value).toBe(true));
    useWhatsNew().closeWhatsNew(true);
    expect(isWhatsNewOpen.value).toBe(false);
    expect(localStorage.getItem(SEEN_KEY)).not.toBeNull();
  });

  it("is offered again when it could not load", async () => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    const { isWhatsNewOpen, useWhatsNew } = await import("../composables/useWhatsNew");
    await vi.waitFor(() => expect(isWhatsNewOpen.value).toBe(true));
    useWhatsNew().closeWhatsNew(false);
    expect(localStorage.getItem(SEEN_KEY)).toBeNull();
  });

  it("stays closed on a fresh install, and the next launch does not open it", async () => {
    const first = await import("../composables/useWhatsNew");
    await vi.waitFor(() => expect(localStorage.getItem(SEEN_KEY)).toBe(first.WHATS_NEW_VERSION));
    expect(first.isWhatsNewOpen.value).toBe(false);
    // The introduction is then seen; the next launch still plays nothing.
    localStorage.setItem(ONBOARDING_KEY, "1");
    vi.resetModules();
    const next = await import("../composables/useWhatsNew");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(next.isWhatsNewOpen.value).toBe(false);
  });
});

/** The video on screen, in French, with a router on `path`. */
async function mountVideo(path = "/") {
  const { createApp, h, nextTick } = await import("vue");
  const { createI18n } = await import("vue-i18n");
  const { createMemoryHistory, createRouter } = await import("vue-router");
  const { default: fr } = await import("../locales/fr");
  const { default: WhatsNewVideo } = await import("../components/WhatsNewVideo.vue");
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:any(.*)*", component: { render: () => null } }],
  });
  await router.push(path);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(WhatsNewVideo) });
  app.use(createI18n({ legacy: false, locale: "fr", messages: { fr } }));
  app.use(router);
  app.mount(host);
  await nextTick();
  return {
    host,
    router,
    video: host.querySelector("video")!,
    buttons: () => [...host.querySelectorAll("footer button")].map((b) => b.textContent?.trim()),
    unmount: () => {
      app.unmount();
      host.remove();
    },
  };
}

describe("the way out", () => {
  async function headerButton(): Promise<string> {
    const shown = await mountVideo();
    const label = shown.host.querySelector("header button")?.textContent?.trim() ?? "";
    shown.unmount();
    return label;
  }

  it("is skipped when it came at launch, closed when it was asked for", async () => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    const { isWhatsNewOpen, useWhatsNew } = await import("../composables/useWhatsNew");
    await vi.waitFor(() => expect(isWhatsNewOpen.value).toBe(true));
    expect(await headerButton()).toBe("Passer");

    useWhatsNew().closeWhatsNew(true);
    useWhatsNew().replayWhatsNew();
    expect(useWhatsNew().whatsNewSource.value).toBe("help");
    expect(await headerButton()).toBe("Fermer");
    useWhatsNew().closeWhatsNew(true);
  });
});

describe("from the page of the version", () => {
  it("plays from the passage asked for, and says which", async () => {
    const { analyticsService } = await import("../services/analyticsService");
    const capture = vi.spyOn(analyticsService, "capture").mockImplementation(() => {});
    const { useWhatsNew } = await import("../composables/useWhatsNew");
    useWhatsNew().replayWhatsNew({ id: "calme", start: 20 });
    const shown = await mountVideo("/aide/nouveautes/4.0");
    vi.spyOn(shown.video, "play").mockResolvedValue();
    shown.video.dispatchEvent(new Event("loadeddata"));
    expect(shown.video.currentTime).toBe(20);
    shown.video.dispatchEvent(new Event("playing"));
    expect(capture).toHaveBeenCalledWith(
      "whats_new_video_started",
      expect.objectContaining({ source: "help", passage: "calme" }),
    );
    // Opened from that page, its end does not lead back to it.
    shown.video.dispatchEvent(new Event("ended"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(shown.buttons()).toEqual(["Revoir la vidéo", "C'est parti"]);
    shown.unmount();
    useWhatsNew().closeWhatsNew(true);
    expect(useWhatsNew().whatsNewPassage.value).toBeNull();
  });

  it("ends on « En savoir plus », which leads to the page of the version", async () => {
    const { analyticsService } = await import("../services/analyticsService");
    const capture = vi.spyOn(analyticsService, "capture").mockImplementation(() => {});
    const { isWhatsNewOpen, useWhatsNew } = await import("../composables/useWhatsNew");
    useWhatsNew().replayWhatsNew();
    const shown = await mountVideo("/aide");
    shown.video.dispatchEvent(new Event("ended"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(shown.buttons()).toEqual(["Revoir la vidéo", "En savoir plus", "C'est parti"]);
    const more = [...shown.host.querySelectorAll<HTMLButtonElement>("footer button")][1];
    more.click();
    await vi.waitFor(() =>
      expect(shown.router.currentRoute.value.path).toBe("/aide/nouveautes/4.0"),
    );
    expect(isWhatsNewOpen.value).toBe(false);
    expect(capture).toHaveBeenCalledWith(
      "whats_new_video_closed",
      expect.objectContaining({ via: "more", passage: null }),
    );
    shown.unmount();
  });
});

describe("the published video", () => {
  it("exists for each language, with its poster, light enough to stream", async () => {
    const { whatsNewVideoUrl } = await import("../composables/useWhatsNew");
    for (const locale of ["fr", "en", "he"]) {
      for (const extension of ["mp4", "jpg"] as const) {
        const url = new URL(whatsNewVideoUrl(locale, extension));
        const file = join(process.cwd(), "public", url.pathname);
        expect(
          existsSync(file),
          `${url.pathname} is missing (promo: npm run render -- --series 4)`,
        ).toBe(true);
        if (extension === "mp4") expect(statSync(file).size).toBeLessThan(8 * 1024 * 1024);
      }
    }
  });

  it("falls back to French for a language without its video", async () => {
    const { whatsNewVideoUrl } = await import("../composables/useWhatsNew");
    expect(whatsNewVideoUrl("de")).toMatch(/-fr\.mp4$/);
  });
});
