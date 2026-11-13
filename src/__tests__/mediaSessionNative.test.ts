import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Un cours s'écoute comme une musique : dans l'app, le lecteur publie ce qui
 * joue à la session média du système (notification d'Android, écran
 * verrouillé d'iOS), et en reçoit les commandes, par
 * @capgo/capacitor-media-session (voir services/mediaSession.ts).
 *
 * Le plugin est un `Proxy` Capacitor, `then` compris (docs/app-native.md,
 * « A plugin never goes through a promise ») : le leurre ci-dessous s'y
 * comporte pareil, et note chaque appel. Sur Android, c'est l'état de lecture
 * qui ouvre et ferme la notification : « playing » ou « paused » la montre,
 * « none » la retire. Le lecteur fermé doit donc dire « none », et ne plus
 * rien dire ensuite.
 */

vi.mock("../composables/useNativeApp", () => ({ isNativeApp: true, appPlatform: "android" }));
vi.mock("../composables/useViewedChiourim", () => ({
  useViewedChiourim: () => ({ markViewed: () => undefined }),
}));
vi.mock("../components/chiourim/coverArtwork", () => ({
  coverArtwork: async () => "data:image/png;base64,UEo=",
}));

type Handler = (details: { action: string; seekTime?: number | null }) => void;
const calls: { method: string; options: Record<string, unknown> }[] = [];
const handlers = new Map<string, Handler>();

const IMPLEMENTED: Record<
  string,
  (options: Record<string, unknown>, cb?: Handler) => Promise<void>
> = {
  setMetadata: async (options) => void calls.push({ method: "setMetadata", options }),
  setPlaybackState: async (options) => void calls.push({ method: "setPlaybackState", options }),
  setPositionState: async (options) => void calls.push({ method: "setPositionState", options }),
  setActionHandler: async (options, cb) => {
    calls.push({ method: "setActionHandler", options });
    if (cb) handlers.set(String(options.action), cb);
  },
};

vi.mock("@capgo/capacitor-media-session", () => ({
  MediaSession: new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop in IMPLEMENTED) return IMPLEMENTED[prop];
        return () =>
          Promise.reject(new Error(`"MediaSession.${prop}()" is not implemented on android`));
      },
    },
  ),
}));

/** Laisse partir les appels au plugin, qui se charge à la demande. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 30));

const states = () =>
  calls.filter((c) => c.method === "setPlaybackState").map((c) => c.options.playbackState);

const track = (n: number) => ({
  src: `https://example.test/cours-${n}.mp3`,
  title: `Cours ${n}`,
  slug: `cours-${n}`,
  subtitle: "Rav Test · Série",
  cover: { seed: "serie", label: "Série" },
});

beforeEach(() => {
  // jsdom ne lit pas d'audio : play et pause disent seulement ce qu'un vrai
  // lecteur dirait.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    queueMicrotask(() => this.dispatchEvent(new Event("pause")));
  });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  calls.length = 0;
});

describe("session média de l'app", () => {
  it("publie le cours qui joue, puis sa pochette", async () => {
    const { useAudioPlayer } = await import("../composables/useAudioPlayer");
    const player = useAudioPlayer();
    player.playQueue([track(1), track(2)], 0, "serie");

    const metadata = () => calls.filter((c) => c.method === "setMetadata").map((c) => c.options);
    await vi.waitFor(() =>
      expect(metadata().at(-1)).toMatchObject({
        title: "Cours 1",
        artwork: [{ src: "data:image/png;base64,UEo=", sizes: "512x512", type: "image/png" }],
      }),
    );
    expect(metadata()[0]).toMatchObject({ title: "Cours 1", artist: "Rav Test · Série" });
    await vi.waitFor(() => expect(states().at(-1)).toBe("playing"));
    player.close();
    await flush();
  });

  it("répond aux commandes du système", async () => {
    const { useAudioPlayer } = await import("../composables/useAudioPlayer");
    const player = useAudioPlayer();
    player.playQueue([track(1), track(2)], 0, "serie");

    await vi.waitFor(() => expect(handlers.size).toBe(8));
    expect([...handlers.keys()].sort()).toEqual(
      [
        "nexttrack",
        "pause",
        "play",
        "previoustrack",
        "seekbackward",
        "seekforward",
        "seekto",
        "stop",
      ].sort(),
    );

    handlers.get("pause")?.({ action: "pause" });
    await vi.waitFor(() => expect(states().at(-1)).toBe("paused"));
    expect(player.isPlaying.value).toBe(false);

    handlers.get("nexttrack")?.({ action: "nexttrack" });
    expect(player.track.value?.slug).toBe("cours-2");
    await vi.waitFor(() => expect(states().at(-1)).toBe("playing"));

    player.close();
    await flush();
  });

  it("retire la notification à la fermeture, et ne la rouvre pas", async () => {
    const { useAudioPlayer } = await import("../composables/useAudioPlayer");
    const player = useAudioPlayer();
    player.playQueue([track(1)], 0, "chiour");
    await vi.waitFor(() => expect(states().at(-1)).toBe("playing"));

    handlers.get("stop")?.({ action: "stop" });
    expect(player.track.value).toBeNull();
    await vi.waitFor(() => expect(states()).toContain("none"));
    // Laisse arriver la pause que provoque la fermeture.
    await flush();
    // La pause que provoque la fermeture arrive après « none » : elle ne doit
    // pas rouvrir une notification « en pause » pour un lecteur fermé.
    expect(states().at(-1)).toBe("none");
  });
});

describe("position publiée", () => {
  it("ne publie pas une durée inconnue, et borne la position", async () => {
    const { publishPosition } = await import("../services/mediaSession");
    publishPosition({ duration: Number.NaN, position: 3, playbackRate: 1 });
    publishPosition({ duration: 0, position: 3, playbackRate: 1 });
    publishPosition({ duration: 100, position: 140, playbackRate: 0 });

    const positions = () =>
      calls.filter((c) => c.method === "setPositionState").map((c) => c.options);
    await vi.waitFor(() => expect(positions()).toHaveLength(1));
    await flush();
    expect(positions()).toEqual([{ duration: 100, position: 100, playbackRate: 1 }]);
  });
});
