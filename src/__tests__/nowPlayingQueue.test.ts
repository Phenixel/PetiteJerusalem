import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import { createI18n } from "vue-i18n";

/**
 * La file du lecteur plein écran (NowPlayingSheet) : ce qui joue, ce qui
 * suit, et au-dessus, repliés, les cours d'avant. Un cours lancé au milieu
 * d'une série n'en perd pas le début : un appui sur « Précédents » le
 * déplie, et un appui sur un cours le lance.
 */

vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("../services/chiourService", () => ({
  chiourService: { getChiourBySlug: vi.fn().mockResolvedValue(null) },
}));
vi.mock("../services/analyticsService", () => ({ analyticsService: { capture: vi.fn() } }));
vi.mock("../components/ShareModal.vue", () => ({
  default: { name: "ShareModalStub", render: () => null },
}));

import fr from "../locales/fr";
import NowPlayingSheet from "../components/chiourim/NowPlayingSheet.vue";
import { useAudioPlayer, type AudioTrack } from "../composables/useAudioPlayer";

let app: App | null = null;
let host: HTMLElement;

const tracks: AudioTrack[] = [1, 2, 3, 4, 5].map((n) => ({
  src: `https://example.test/${n}.mp3`,
  title: `Cours ${n}`,
  slug: `cours-${n}`,
  context: "Pélé Yoets",
}));

async function mountSheet(index: number) {
  const player = useAudioPlayer();
  player.playQueue(tracks, index, "serie");
  host = document.createElement("div");
  document.body.appendChild(host);
  app = createApp({ render: () => h(NowPlayingSheet) });
  app.use(createI18n({ legacy: false, locale: "fr", messages: { fr } }));
  app.mount(host);
  await nextTick();
  return player;
}

const toggle = () => host.querySelector<HTMLButtonElement>('[aria-controls="sheet-earlier"]');
const earlierList = () => host.querySelector<HTMLElement>("#sheet-earlier")!;

beforeEach(() => {
  // Sans mouvement : jsdom ne sait pas animer.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
});

afterEach(() => {
  useAudioPlayer().close();
  app?.unmount();
  host?.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("la file du lecteur plein écran", () => {
  it("garde les cours d'avant repliés au-dessus de ce qui joue", async () => {
    await mountSheet(3);
    const button = toggle();
    expect(button?.textContent).toContain("Précédents");
    expect(button?.textContent).toContain("3 cours");
    expect(button?.getAttribute("aria-expanded")).toBe("false");
    expect(earlierList().style.display).toBe("none");
  });

  it("les déplie d'un appui, dans l'ordre, et un appui en lance un", async () => {
    const player = await mountSheet(3);
    toggle()!.click();
    await nextTick();
    expect(toggle()!.getAttribute("aria-expanded")).toBe("true");
    expect(earlierList().style.display).toBe("");
    const rows = [...earlierList().querySelectorAll("li")];
    const shown = rows.map((row) => [
      row.querySelector(".tabular-nums")?.textContent?.trim(),
      row.querySelector('[dir="auto"]')?.textContent?.trim(),
    ]);
    expect(shown).toEqual([
      ["1", "Cours 1"],
      ["2", "Cours 2"],
      ["3", "Cours 3"],
    ]);

    rows[1].querySelector("button")!.click();
    await nextTick();
    expect(player.queueIndex.value).toBe(1);
    expect(toggle()!.textContent).toContain("1 cours");
  });

  it("n'a rien au-dessus quand la file commence par ce qui joue", async () => {
    await mountSheet(0);
    expect(toggle()).toBeNull();
    expect(host.textContent).toContain("En cours");
  });
});
