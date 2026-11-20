import { existsSync, readFileSync, statSync } from "node:fs";
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

vi.mock("../config/platform", () => ({ isNativeApp: true, appPlatform: "ios" }));

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

  /**
   * iOS plays a video only from a server that answers a byte range with a
   * 206, and Firebase Hosting answers ranges only for a file its CDN may
   * cache: left on the `no-cache` of the catch-all, the video never played
   * in the iOS app (376 launches, 53 readers, from 4.0 on; the Android app,
   * which streams it whole, played it). The webview also reads it from its
   * own origin (`capacitor://localhost`), as it does the texts and the
   * fonts, hence the cross-origin header.
   */
  it("is served cacheable and cross-origin, so the app can play it", () => {
    const hosting = JSON.parse(readFileSync(join(process.cwd(), "firebase.json"), "utf8")).hosting;
    const rules: { source: string; headers: { key: string; value: string }[] }[] = hosting.headers;
    const media = "**/*.@(mp4|m4v|webm|mp3|m4a)";
    const header = (key: string) =>
      rules.find((rule) => rule.source === media)?.headers.find((one) => one.key === key)?.value;
    expect(header("Cache-Control"), `firebase.json: ${media} must stay cacheable`).toMatch(
      /^public,/,
    );
    expect(header("Access-Control-Allow-Origin")).toBe("*");
    // After the catch-all, whose `no-cache` it has to override.
    expect(rules.findIndex((rule) => rule.source === media)).toBeGreaterThan(
      rules.findIndex((rule) => rule.source === "**"),
    );
  });
});

describe("when it does not load", () => {
  it("says what failed: the player's own error, or the wait", async () => {
    const { analyticsService } = await import("../services/analyticsService");
    const capture = vi.spyOn(analyticsService, "capture").mockImplementation(() => {});
    const { useWhatsNew } = await import("../composables/useWhatsNew");
    useWhatsNew().replayWhatsNew();
    const shown = await mountVideo("/aide");
    Object.defineProperty(shown.video, "error", {
      configurable: true,
      value: { code: 4, message: "The operation is not supported." },
    });
    shown.video.dispatchEvent(new Event("error"));
    expect(capture).toHaveBeenCalledWith(
      "whats_new_video_closed",
      expect.objectContaining({
        via: "error",
        error_source: "media",
        error_code: 4,
        error_message: "The operation is not supported.",
      }),
    );
    shown.unmount();
  });

  it("reports the wait that ran out, with no error of its own", async () => {
    vi.useFakeTimers();
    try {
      const { analyticsService } = await import("../services/analyticsService");
      const capture = vi.spyOn(analyticsService, "capture").mockImplementation(() => {});
      const { useWhatsNew } = await import("../composables/useWhatsNew");
      useWhatsNew().replayWhatsNew();
      const shown = await mountVideo("/aide");
      vi.advanceTimersByTime(20000);
      expect(capture).toHaveBeenCalledWith(
        "whats_new_video_closed",
        expect.objectContaining({
          via: "error",
          error_source: "timeout",
          error_code: null,
          error_message: null,
        }),
      );
      shown.unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("while nothing shows", () => {
  /**
   * At launch the screen only appears once the video can play, and that wait
   * now lasts up to a minute. Until then the app behind must stay as it was:
   * holding it from the moment the component mounted left the home page
   * unable to scroll under an invisible overlay, at every launch of the iOS
   * app from 4.0 on, while the video would not load (see
   * docs/design.md, "The site must serve it cacheable").
   */
  it("leaves the page alone, and holds it once the video is on screen", async () => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    const { hasOpenOverlay } = await import("../composables/useOverlayStack");
    const { isWhatsNewOpen, useWhatsNew } = await import("../composables/useWhatsNew");
    await vi.waitFor(() => expect(isWhatsNewOpen.value).toBe(true));
    const { nextTick } = await import("vue");
    const shown = await mountVideo();
    expect(document.documentElement.style.overflow).toBe("");
    expect(hasOpenOverlay()).toBe(false);

    vi.spyOn(shown.video, "play").mockResolvedValue();
    shown.video.dispatchEvent(new Event("loadeddata"));
    await nextTick();
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(hasOpenOverlay()).toBe(true);

    shown.unmount();
    expect(document.documentElement.style.overflow).toBe("");
    expect(hasOpenOverlay()).toBe(false);
    useWhatsNew().closeWhatsNew(true);
  });
});

describe("the wait for a video that is slow to come", () => {
  it("says how far the load got when it runs out", async () => {
    vi.useFakeTimers();
    try {
      const { analyticsService } = await import("../services/analyticsService");
      const capture = vi.spyOn(analyticsService, "capture").mockImplementation(() => {});
      const { useWhatsNew } = await import("../composables/useWhatsNew");
      useWhatsNew().replayWhatsNew();
      const shown = await mountVideo("/aide");
      vi.advanceTimersByTime(20000);
      // Nothing came at all: that is not a download too slow to finish, and
      // it is what the Error tracking could not tell apart before.
      expect(capture).toHaveBeenCalledWith(
        "whats_new_video_closed",
        expect.objectContaining({
          error_source: "timeout",
          ready_state: 0,
          network_state: 0,
          buffered_seconds: 0,
          waited_ms: 20000,
        }),
      );
      shown.unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives the video another turn as long as bytes keep arriving", async () => {
    vi.useFakeTimers();
    try {
      const { analyticsService } = await import("../services/analyticsService");
      const capture = vi.spyOn(analyticsService, "capture").mockImplementation(() => {});
      const { useWhatsNew } = await import("../composables/useWhatsNew");
      useWhatsNew().replayWhatsNew();
      const shown = await mountVideo("/aide");
      // A download that advances is worth waiting for: nothing shows while it
      // loads and the app stays usable behind it.
      shown.video.dispatchEvent(new Event("progress"));
      vi.advanceTimersByTime(20000);
      expect(capture).not.toHaveBeenCalled();
      shown.video.dispatchEvent(new Event("progress"));
      vi.advanceTimersByTime(20000);
      expect(capture).not.toHaveBeenCalled();
      // Three turns, a minute in all: it gives up even while bytes come.
      shown.video.dispatchEvent(new Event("progress"));
      vi.advanceTimersByTime(20000);
      expect(capture).toHaveBeenCalledWith(
        "whats_new_video_closed",
        expect.objectContaining({ error_source: "timeout", waited_ms: 60000 }),
      );
      shown.unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});
