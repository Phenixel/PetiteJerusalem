import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import { createI18n } from "vue-i18n";

/**
 * Moving between commentators in the study panel (CommentaryPanel.vue, see
 * docs/design.md): with several commentaries on a passage, a row of tabs at
 * the top of the panel names them, a tap scrolls to that commentator, and
 * the tab follows. A single commentary has no tabs.
 */

const { capture } = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock("../services/analyticsService", () => ({ analyticsService: { capture } }));
vi.mock("../composables/useNativeApp", () => ({ isNativeApp: false, appPlatform: "web" }));

import fr from "../locales/fr";
import CommentaryPanel from "../components/CommentaryPanel.vue";
import type { CommentaryGroup } from "../composables/usePassageCommentaries";

const comment = (text: string) => ({ lead: "", text });
const bartenura: CommentaryGroup = {
  source: "bartenura",
  comments: [comment("א"), comment("ב")],
};
const tyt: CommentaryGroup = { source: "tosafotYomTov", comments: [comment("ג")] };

let app: App | null = null;
afterEach(() => {
  app?.unmount();
  app = null;
  document.body.innerHTML = "";
  capture.mockClear();
});

async function mount(groups: CommentaryGroup[]) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  app = createApp({
    render: () => h(CommentaryPanel, { place: "Chapitre 1 · michna 2", groups, state: "ready" }),
  });
  app.use(createI18n({ legacy: false, locale: "fr", messages: { fr } }));
  app.mount(host);
  await nextTick();
  return document.body;
}

const tabs = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>(".commentary-tab")];

describe("the commentators' tabs", () => {
  it("name each commentator with its count, the first one active", async () => {
    const root = await mount([bartenura, tyt]);
    expect(tabs(root).map((tab) => tab.textContent?.replace(/\s+/g, " ").trim())).toEqual([
      "Bartenura 2",
      "Tossefot Yom Tov 1",
    ]);
    expect(tabs(root)[0].getAttribute("aria-current")).toBe("true");
  });

  it("scroll to the commentator touched, whose tab becomes active", async () => {
    const root = await mount([bartenura, tyt]);
    const body = root.querySelector<HTMLElement>(".sheet-body")!;
    const scrollTo = vi.fn();
    body.scrollTo = scrollTo;

    tabs(root)[1].click();
    await nextTick();
    expect(scrollTo).toHaveBeenCalledOnce();
    expect(tabs(root)[1].getAttribute("aria-current")).toBe("true");
    expect(tabs(root)[0].getAttribute("aria-current")).toBeNull();
    expect(capture).toHaveBeenCalledWith("commentaries_jumped", {
      source: "tosafotYomTov",
      position: 1,
    });
  });

  it("are not there for a single commentator", async () => {
    const root = await mount([bartenura]);
    expect(root.querySelector(".commentary-nav")).toBeNull();
  });
});
