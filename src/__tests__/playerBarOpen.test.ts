import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import { createI18n } from "vue-i18n";

/**
 * La barre du lecteur ouvre le plein écran d'un appui n'importe où sur elle,
 * et sur un téléphone d'un glissement vers le haut : il ne fallait plus viser
 * la pochette ou la flèche. Ses boutons (lecture, suivant, fermer) gardent
 * leur rôle et n'ouvrent rien (voir GlobalAudioPlayer).
 */

vi.mock("../components/chiourim/NowPlayingSheet.vue", () => ({
  default: { name: "NowPlayingSheetStub", render: () => null },
}));
vi.mock("../composables/useViewedChiourim", () => ({
  useViewedChiourim: () => ({ markViewed: () => undefined }),
}));

import fr from "../locales/fr";
import GlobalAudioPlayer from "../components/GlobalAudioPlayer.vue";
import { useAudioPlayer } from "../composables/useAudioPlayer";

let app: App | null = null;
let host: HTMLElement;

async function mountBar() {
  host = document.createElement("div");
  document.body.appendChild(host);
  app = createApp({ render: () => h(GlobalAudioPlayer) });
  app.use(createI18n({ legacy: false, locale: "fr", messages: { fr } }));
  app.mount(host);
  const player = useAudioPlayer();
  player.playQueue(
    [
      { src: "https://example.test/1.mp3", title: "Cours 1", slug: "cours-1" },
      { src: "https://example.test/2.mp3", title: "Cours 2", slug: "cours-2" },
    ],
    0,
    "serie",
  );
  await nextTick();
  const bar = host.querySelector<HTMLElement>(".cursor-pointer");
  if (!bar) throw new Error("barre du lecteur introuvable");
  return { player, bar };
}

/** Un toucher qui glisse de `from` à `to` (en pixels, vers le haut si to < from). */
function swipe(el: HTMLElement, from: number, to: number) {
  const fire = (type: string, y: number) => {
    const event = new Event(type, { bubbles: true });
    Object.defineProperty(event, "touches", { value: [{ clientX: 100, clientY: y }] });
    el.dispatchEvent(event);
  };
  fire("touchstart", from);
  fire("touchmove", (from + to) / 2);
  fire("touchmove", to);
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    this.dispatchEvent(new Event("pause"));
  });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
});

afterEach(() => {
  useAudioPlayer().close();
  app?.unmount();
  host?.remove();
  vi.restoreAllMocks();
});

describe("ouvrir le plein écran depuis la barre", () => {
  it("un appui sur la barre elle-même l'ouvre", async () => {
    const { player, bar } = await mountBar();
    bar.click();
    expect(player.sheetOpen.value).toBe(true);
  });

  it("ses boutons gardent leur rôle et n'ouvrent rien", async () => {
    const { player, bar } = await mountBar();
    const pause = bar.querySelector<HTMLButtonElement>('button[aria-label="Pause"]');
    pause?.click();
    expect(player.isPlaying.value).toBe(false);
    expect(player.sheetOpen.value).toBe(false);
  });

  it("un glissement vers le haut l'ouvre, pas un glissement vers le bas", async () => {
    const { player, bar } = await mountBar();
    swipe(bar, 400, 420);
    expect(player.sheetOpen.value).toBe(false);
    swipe(bar, 400, 340);
    expect(player.sheetOpen.value).toBe(true);
  });
});
