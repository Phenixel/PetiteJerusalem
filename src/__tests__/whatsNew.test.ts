import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The "what's new" video (useWhatsNew, WhatsNewVideo.vue).
 *
 * Three promises: it plays once after an update, never on a fresh install
 * (the introduction is there for that), and only in the app; and the video it
 * asks the site for exists, in each language, under the name the code reads.
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
