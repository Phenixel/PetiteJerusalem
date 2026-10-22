import { APP_SITE_URL } from "../config/environment";
import { isNativeApp } from "../composables/useNativeApp";
import type { HelpLocale } from "../content/help/catalog";

/**
 * The help center's videos: tutorials filmed by the team and published on
 * YouTube (docs/help-center.md).
 *
 * Their list is a file the site serves, `public/help/videos.json`, and not
 * code: a new video reaches the installed apps as soon as the site is
 * deployed, without waiting for a release. The app asks its site for it
 * (the staging app, the staging site), and falls back on the copy it
 * carries in its bundle when the network does not answer: offline, the
 * list is the one of its build, and a video opens on YouTube anyway only
 * with a network.
 *
 * An installed app can read a list newer than its code: an entry it does
 * not understand (no valid YouTube id, no French title) is left out rather
 * than breaking the page, and a field it does not know is ignored.
 */

export type HelpVideo = {
  /** The YouTube id: the eleven characters after `v=`. */
  youtube: string;
  /** Its title, French at least; another language falls back on French. */
  title: Partial<Record<HelpLocale, string>> & { fr: string };
  /** Its length, as YouTube writes it (« 3:42 »). */
  duration?: string;
  /** The help topic it belongs to (catalog.ts, HELP_TOPICS). */
  topic?: string;
  /** The guide it goes with: it is shown at the end of that guide too. */
  guide?: string;
};

export const HELP_VIDEOS_PATH = "/help/videos.json";

const YOUTUBE_ID = /^[\w-]{11}$/;
const DURATION = /^(\d+:)?\d{1,2}:\d{2}$/;
const REMOTE_TIMEOUT_MS = 6000;

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** The entries of the file that can be shown; the others are left out. */
export function parseHelpVideos(raw: unknown): HelpVideo[] {
  const list = (raw as { videos?: unknown } | null)?.videos;
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry): HelpVideo[] => {
    if (!entry || typeof entry !== "object") return [];
    const e = entry as Record<string, unknown>;
    const youtube = text(e.youtube);
    const titles = (e.title ?? {}) as Record<string, unknown>;
    const fr = text(titles.fr);
    if (!youtube || !YOUTUBE_ID.test(youtube) || !fr) return [];
    const duration = text(e.duration);
    return [
      {
        youtube,
        title: { fr, en: text(titles.en), he: text(titles.he) },
        ...(duration && DURATION.test(duration) ? { duration } : {}),
        ...(text(e.topic) ? { topic: text(e.topic) } : {}),
        ...(text(e.guide) ? { guide: text(e.guide) } : {}),
      },
    ];
  });
}

export function videoTitle(video: HelpVideo, locale: string): string {
  return video.title[locale as HelpLocale] ?? video.title.fr;
}

/** Where the video plays: YouTube, in its app when the phone has it. */
export function youtubeUrl(video: HelpVideo): string {
  return `https://www.youtube.com/watch?v=${video.youtube}`;
}

/** Its picture, 16:9, as YouTube serves it. */
export function youtubeThumbnail(video: HelpVideo): string {
  return `https://i.ytimg.com/vi/${video.youtube}/mqdefault.jpg`;
}

async function fetchList(url: string, timeoutMs?: number): Promise<HelpVideo[]> {
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
  try {
    const response = await fetch(url, { cache: "no-cache", signal: controller.signal });
    if (!response.ok) throw new Error(`help videos: HTTP ${response.status}`);
    return parseHelpVideos(await response.json());
  } finally {
    if (timer) clearTimeout(timer);
  }
}

let loading: Promise<HelpVideo[]> | null = null;

/**
 * The list, once per opening of the app. The site reads its own file; the
 * app asks its site, then its bundle. Nothing at all: an empty list, and
 * the help center simply shows no videos.
 */
export function loadHelpVideos(): Promise<HelpVideo[]> {
  loading ??= (async () => {
    if (isNativeApp) {
      try {
        return await fetchList(`${APP_SITE_URL}${HELP_VIDEOS_PATH}`, REMOTE_TIMEOUT_MS);
      } catch {
        // Offline, or the site does not answer: the copy of the build.
      }
    }
    try {
      return await fetchList(HELP_VIDEOS_PATH);
    } catch {
      return [];
    }
  })();
  return loading;
}
