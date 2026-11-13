import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import { createI18n } from "vue-i18n";

/**
 * The seek bar follows the finger, then the playback, without going back.
 * Setting `currentTime` starts a seek, but the element only fires
 * `timeupdate` once the audio at the new position has been downloaded: in
 * the meantime the bar, released at the new position, fell back to the old
 * one, then jumped to the right place. jsdom fires no media event on its
 * own, which is exactly that moment in between (see useAudioPlayer, seekTo).
 */

vi.mock("../services/analyticsService", () => ({ analyticsService: { capture: vi.fn() } }));
vi.mock("../composables/useViewedChiourim", () => ({
  useViewedChiourim: () => ({ markViewed: () => undefined }),
}));

import fr from "../locales/fr";
import PlayerSeek from "../components/chiourim/PlayerSeek.vue";
import { useAudioPlayer } from "../composables/useAudioPlayer";
import { recordPosition, reloadListening } from "../services/listeningProgress";

let app: App | null = null;
let host: HTMLElement;
let play: MockInstance<HTMLMediaElement["play"]>;

/** A ten-minute class, whose length the catalog already knows. */
const track = {
  src: "https://example.test/cours.mp3",
  title: "Cours",
  slug: "cours",
  duration: 600,
};

/** The player's element: the one it last asked to play. */
function media(): HTMLMediaElement {
  const element = play.mock.contexts.at(-1) as HTMLMediaElement | undefined;
  if (!element) throw new Error("the player never asked to play");
  return element;
}

/** The element reaches this second while playing. */
function playTo(seconds: number) {
  media().currentTime = seconds;
  media().dispatchEvent(new Event("timeupdate"));
}

/** The class starts, and its metadata arrives. */
function startLoaded() {
  useAudioPlayer().play(track);
  Object.defineProperty(media(), "duration", { value: 600, configurable: true });
  media().dispatchEvent(new Event("loadedmetadata"));
}

async function mountSeek() {
  host = document.createElement("div");
  document.body.appendChild(host);
  app = createApp({ render: () => h(PlayerSeek) });
  app.use(createI18n({ legacy: false, locale: "fr", messages: { fr } }));
  app.mount(host);
  await nextTick();
}

const range = () => host.querySelector<HTMLInputElement>('input[type="range"]')!;
const fill = () => host.querySelector<HTMLElement>(".seek-fill")!.style.width;
const elapsed = () => host.querySelector("span")!.textContent;

/** The finger drags the cursor to this percentage, then lets go. */
async function release(percent: number) {
  range().value = String(percent);
  range().dispatchEvent(new Event("input"));
  await nextTick();
  range().dispatchEvent(new Event("change"));
  await nextTick();
}

beforeEach(() => {
  play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
});

afterEach(() => {
  useAudioPlayer().close();
  app?.unmount();
  host?.remove();
  localStorage.clear();
  reloadListening();
  vi.restoreAllMocks();
});

describe("the seek bar", () => {
  it("stays where it is released while the seek lands", async () => {
    startLoaded();
    await mountSeek();
    playTo(120);
    await nextTick();
    expect(fill()).toBe("20%");

    await release(50);
    // No timeupdate yet: the audio at 5:00 is still downloading.
    expect(media().currentTime).toBe(300);
    expect(fill()).toBe("50%");
    expect(elapsed()).toBe("5:00");
  });

  it("moves at once with back 15 s and forward 30 s", async () => {
    startLoaded();
    await mountSeek();
    playTo(120);
    const player = useAudioPlayer();

    player.skip(30);
    await nextTick();
    expect(fill()).toBe("25%");
    expect(elapsed()).toBe("2:30");

    player.skip(-15);
    await nextTick();
    expect(player.currentTime.value).toBe(135);
    expect(elapsed()).toBe("2:15");
  });

  it("shows the second the audio is at, and only re-renders when it changes", async () => {
    startLoaded();
    await mountSeek();
    const player = useAudioPlayer();

    playTo(3.9);
    playTo(4.1);
    await nextTick();
    expect(elapsed()).toBe("0:04");

    // Within the same second, nothing is published.
    playTo(4.6);
    expect(player.currentTime.value).toBe(4.1);
  });

  it("keeps a seek asked before the metadata where it was released", async () => {
    useAudioPlayer().play(track);
    await mountSeek();

    await release(25);
    expect(fill()).toBe("25%");

    Object.defineProperty(media(), "duration", { value: 600, configurable: true });
    media().dispatchEvent(new Event("loadedmetadata"));
    await nextTick();
    expect(media().currentTime).toBe(150);
    expect(fill()).toBe("25%");
  });

  it("shows where a class resumes before its metadata arrives", async () => {
    recordPosition(track.slug, 200, 600);
    const player = useAudioPlayer();
    player.play(track);
    await mountSeek();

    // resumePosition goes back three seconds to find the thread again.
    expect(elapsed()).toBe("3:17");
    expect(player.progress.value).toBeGreaterThan(32);
  });
});
