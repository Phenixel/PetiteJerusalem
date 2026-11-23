import { devicePreference } from "./devicePreference";

/**
 * The window that offers the app on the website (AppDownloadPrompt.vue):
 * whether it may come, and what the device remembers of it.
 */

/** « Plus tard »: the window may come back after sixty days. */
export const APP_PROMPT_SNOOZE_MS = 60 * 24 * 60 * 60 * 1000;

export interface AppPromptState {
  /** Closed without a store, at this time (ms). */
  snoozedAt?: number;
  /** A store opened: never again. */
  done?: boolean;
}

export const appPromptStore = devicePreference<AppPromptState>(
  "pj_app_prompt",
  (raw) => {
    try {
      const value = raw ? (JSON.parse(raw) as AppPromptState) : null;
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  },
  JSON.stringify,
);

/** Crawlers and test browsers read the page as it is, without the window. */
const ROBOT = /bot|crawl|spider|slurp|lighthouse|headless/i;

/** Whether the window may come, given what the device remembers. */
export function appPromptDue(
  state: AppPromptState | null,
  now: number,
  userAgent: string,
): boolean {
  if (ROBOT.test(userAgent)) return false;
  if (state?.done) return false;
  return state?.snoozedAt === undefined || now - state.snoozedAt >= APP_PROMPT_SNOOZE_MS;
}
