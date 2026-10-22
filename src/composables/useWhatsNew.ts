import { computed, ref } from "vue";
import { APP_SITE_URL } from "../config/environment";
import { devicePreference } from "../services/devicePreference";
import { isNativeApp } from "./useNativeApp";

/**
 * The "what's new" video: after an update that moves things around (4.0
 * moved the library and the classes under « Étude », gave the Sidour its
 * tab), the app plays, once, a short video of what changed, in the
 * reader's language. Made with the promotional videos (promo/README.md,
 * `nouveautes-*`), it is served by the site (`public/videos/`, left out of
 * the native bundle) so as not to weigh on the app.
 *
 * Native app only, like the introduction: that is where an update lands. A
 * fresh install sees the introduction instead, and never this video: it
 * shows a change to someone who never knew the app before it.
 *
 * Shown once per version: the device notes the version it played (local
 * storage, and the native preferences as a safety net, see
 * devicePreference). If the video cannot load (no network at launch), nothing
 * shows and nothing is noted: it plays at a later launch. Its card at the
 * top of the help center (WhatsNewCard, /aide) plays it again, the page of
 * the version (/aide/nouveautes/4.0) plays it from one of its passages, and
 * `?nouveautes` in the address opens it anywhere, site included, to show it
 * or try it on a preview channel.
 *
 * Changing WHATS_NEW_VERSION offers a new video to everyone: only with that
 * video rendered and published under its name (promo, `appFile`).
 */

/** The version whose video plays; the device notes it once played. */
export const WHATS_NEW_VERSION = "4.0";

const STORAGE_KEY = "pj_whats_new_seen";
/** The introduction's key (useOnboarding): absent, this device is a fresh install. */
const ONBOARDING_KEY = "pj_onboarding_seen";
const URL_PARAM = "nouveautes";

const VIDEO_LOCALES = ["fr", "en", "he"] as const;
type VideoLocale = (typeof VIDEO_LOCALES)[number];

/** Where the video was opened from: at launch, from the help center, by its address. */
export type WhatsNewSource = "launch" | "help" | "link";

/**
 * What to do at launch:
 *  - `play`: an update, video not seen yet;
 *  - `mark`: a fresh install (the introduction has not been seen): note the
 *    video as seen without playing it;
 *  - `skip`: nothing (the site, or already seen).
 */
export function launchDecision({
  native,
  seen,
  onboardingSeen,
}: {
  native: boolean;
  seen: string | null;
  onboardingSeen: string | null;
}): "play" | "mark" | "skip" {
  if (!native || seen === WHATS_NEW_VERSION) return "skip";
  if (onboardingSeen === null) return "mark";
  return "play";
}

/** The video's address for a language (French when the language has none). */
export function whatsNewVideoUrl(locale: string, extension: "mp4" | "jpg" = "mp4"): string {
  const lang: VideoLocale = (VIDEO_LOCALES as readonly string[]).includes(locale)
    ? (locale as VideoLocale)
    : "fr";
  return `${APP_SITE_URL}/videos/nouveautes-${WHATS_NEW_VERSION}-${lang}.${extension}`;
}

const store = devicePreference<string>(
  STORAGE_KEY,
  (raw) => raw,
  (value) => value,
);

const source = ref<WhatsNewSource | null>(null);

/** A passage to play from (the page of the version), or null for the whole video. */
export type WhatsNewPassage = { id: string; start: number };

const passage = ref<WhatsNewPassage | null>(null);

function readOnboardingSeen(): string | null {
  try {
    return localStorage.getItem(ONBOARDING_KEY);
  } catch {
    return null;
  }
}

function askedByUrl(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has(URL_PARAM);
}

/** Decides, once, at launch. */
async function decideAtLaunch(): Promise<void> {
  if (askedByUrl()) {
    source.value = "link";
    return;
  }
  if (!isNativeApp) return;
  // The webview's storage can be emptied by the system: the native
  // preferences say whether this device already played the video.
  const seen = store.read() ?? (await store.restore());
  const decision = launchDecision({ native: true, seen, onboardingSeen: readOnboardingSeen() });
  if (decision === "mark") store.write(WHATS_NEW_VERSION);
  if (decision === "play") source.value = "launch";
}

void decideAtLaunch();

/** Is the video on screen (or loading to be)? */
export const isWhatsNewOpen = computed(() => source.value !== null);

export function useWhatsNew() {
  /**
   * Closes the video. `seen`: note it as played (false when it could not
   * load at launch: it will be offered again).
   */
  function closeWhatsNew(seen: boolean): void {
    if (seen) store.write(WHATS_NEW_VERSION);
    source.value = null;
    passage.value = null;
  }

  /**
   * The help center plays it again: whole (its card), or from one of its
   * passages (the page of the version).
   */
  function replayWhatsNew(from: WhatsNewPassage | null = null): void {
    passage.value = from;
    source.value = "help";
  }

  return {
    isWhatsNewOpen,
    whatsNewSource: source,
    whatsNewPassage: passage,
    closeWhatsNew,
    replayWhatsNew,
  };
}
