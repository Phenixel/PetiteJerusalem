/**
 * La session média : ce que le système montre du cours qui joue, et les
 * commandes qu'il en renvoie. Sur Android, la notification (et la carte du
 * lecteur dans les réglages rapides, l'écran verrouillé) ; sur iOS, l'écran
 * verrouillé et le centre de contrôle ; sur un ordinateur, les touches
 * multimédia et le lecteur du navigateur. Un cours s'écoute comme une
 * musique : on le met en pause, on avance, on passe au suivant sans rouvrir
 * l'app.
 *
 * Sur le site, c'est l'API Media Session du navigateur. Dans l'app, la webview
 * d'Android n'en fait rien : @capgo/capacitor-media-session y tient une vraie
 * session média native, dans un service de premier plan qui garde aussi la
 * lecture en vie écran éteint. Sur iOS, le plugin repasse par l'API du
 * WKWebView, que le système relaie (avec le mode d'arrière-plan « audio »,
 * voir scripts/setup-ios.mjs).
 *
 * Tout part sans attendre et sans jamais lever : la lecture ne dépend pas de
 * ce que le système en affiche. Le plugin se charge à la demande, et se
 * déstructure sur place (docs/app-native.md, « Un plugin ne traverse jamais
 * une promesse »). Ses appels passent en file, dans l'ordre où le lecteur les
 * fait : une pause suivie d'une lecture ne doit pas arriver à l'envers, la
 * notification resterait en pause sur un cours qui joue.
 */
import { isNativeApp } from "../composables/useNativeApp";

let nativeQueue: Promise<void> = Promise.resolve();

/** Un appel au plugin, après ceux d'avant ; un échec n'arrête pas la file. */
function enqueue(task: () => Promise<unknown>): void {
  nativeQueue = nativeQueue.then(task).then(
    () => undefined,
    () => undefined,
  );
}

export type MediaPlaybackState = "none" | "paused" | "playing";

export type MediaAction =
  | "play"
  | "pause"
  | "seekbackward"
  | "seekforward"
  | "previoustrack"
  | "nexttrack"
  | "seekto"
  | "stop";

export interface MediaInfo {
  title: string;
  artist: string;
  album: string;
  /** La pochette en image (voir coverArtwork), si elle est prête. */
  artwork?: string | null;
}

export interface MediaPosition {
  /** En secondes. */
  duration: number;
  position: number;
  playbackRate: number;
}

export type MediaActionHandlers = Partial<
  Record<MediaAction, (details: { seekTime?: number | null }) => void>
>;

function webSession(): MediaSession | null {
  return typeof navigator !== "undefined" && "mediaSession" in navigator
    ? navigator.mediaSession
    : null;
}

function artworkOf(info: MediaInfo) {
  return info.artwork ? [{ src: info.artwork, sizes: "512x512", type: "image/png" }] : [];
}

/** Le titre, le rav et la série, la pochette. */
export function publishMetadata(info: MediaInfo): void {
  const metadata = {
    title: info.title,
    artist: info.artist,
    album: info.album,
    artwork: artworkOf(info),
  };
  if (isNativeApp) {
    enqueue(async () => {
      const { MediaSession } = await import("@capgo/capacitor-media-session");
      await MediaSession.setMetadata(metadata);
    });
    return;
  }
  const session = webSession();
  if (session && typeof MediaMetadata !== "undefined") {
    session.metadata = new MediaMetadata(metadata);
  }
}

/**
 * En lecture, en pause, ou plus rien (le lecteur fermé). Sur Android, c'est
 * ce qui ouvre et ferme la notification : elle reste en pause, et part avec
 * « none ».
 */
export function publishPlaybackState(state: MediaPlaybackState): void {
  if (isNativeApp) {
    enqueue(async () => {
      const { MediaSession } = await import("@capgo/capacitor-media-session");
      await MediaSession.setPlaybackState({ playbackState: state });
    });
    return;
  }
  const session = webSession();
  if (session) session.playbackState = state;
}

/**
 * Où en est le cours. Le système fait avancer la barre seul à partir de la
 * position, de la durée et de la vitesse : on ne republie qu'à un changement
 * (lecture, pause, saut, vitesse), pas à chaque seconde.
 */
export function publishPosition({ duration, position, playbackRate }: MediaPosition): void {
  if (!Number.isFinite(duration) || duration <= 0) return;
  const state = {
    duration,
    position: Math.max(0, Math.min(position, duration)),
    playbackRate: playbackRate > 0 ? playbackRate : 1,
  };
  if (isNativeApp) {
    enqueue(async () => {
      const { MediaSession } = await import("@capgo/capacitor-media-session");
      await MediaSession.setPositionState(state);
    });
    return;
  }
  try {
    webSession()?.setPositionState?.(state);
  } catch {
    // Une position que le navigateur refuse : la barre du système s'en passe.
  }
}

/** Les commandes du système, branchées une fois pour toutes sur le lecteur. */
export function bindMediaActions(handlers: MediaActionHandlers): void {
  const entries = Object.entries(handlers) as [
    MediaAction,
    (details: { seekTime?: number | null }) => void,
  ][];
  if (isNativeApp) {
    enqueue(async () => {
      const { MediaSession } = await import("@capgo/capacitor-media-session");
      for (const [action, handler] of entries) {
        await MediaSession.setActionHandler({ action }, (details) => handler(details ?? {}));
      }
    });
    return;
  }
  const session = webSession();
  if (!session) return;
  for (const [action, handler] of entries) {
    try {
      session.setActionHandler(action, (details) => handler(details ?? {}));
    } catch {
      // Une commande que ce navigateur ne connaît pas (« stop », « seekto ») : on s'en passe.
    }
  }
}
