import { describe, expect, it } from "vitest";
import { APP_PROMPT_SNOOZE_MS, appPromptDue } from "../services/appPrompt";

/**
 * The window that offers the app on the website (AppDownloadPrompt): once,
 * back sixty days after « Plus tard », never after a store was opened, and
 * never to a crawler.
 */
const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0";
const NOW = Date.parse("2026-11-23T12:00:00Z");

describe("appPromptDue", () => {
  it("comes on a first visit", () => {
    expect(appPromptDue(null, NOW, CHROME)).toBe(true);
  });

  it("waits sixty days after « Plus tard »", () => {
    expect(appPromptDue({ snoozedAt: NOW - 1000 }, NOW, CHROME)).toBe(false);
    expect(appPromptDue({ snoozedAt: NOW - APP_PROMPT_SNOOZE_MS }, NOW, CHROME)).toBe(true);
  });

  it("never comes back once a store was opened", () => {
    expect(appPromptDue({ done: true }, NOW, CHROME)).toBe(false);
  });

  it("is never shown to a crawler", () => {
    const googlebot =
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    expect(appPromptDue(null, NOW, googlebot)).toBe(false);
  });
});
