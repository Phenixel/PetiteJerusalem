import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";

/**
 * Dans l'app native, les commandes d'un passage montent dans un bottom sheet
 * au lieu d'une bulle posée sur le passage : mêmes commandes, même rangée des
 * commentaires, et le volet poussé vers le bas relâche le passage.
 */

vi.mock("../services/analyticsService", () => ({
  analyticsService: { capture: vi.fn() },
}));
vi.mock("../composables/useNativeApp", () => ({ isNativeApp: true, appPlatform: "android" }));

import fr from "../locales/fr";
import ReadingSelectionMenu from "../components/ReadingSelectionMenu.vue";
import { clearPassage, readingPassage, selectPassage } from "../composables/useReadingSelection";

let monte: App | null = null;
afterEach(() => {
  monte?.unmount();
  monte = null;
  clearPassage();
  document.body.innerHTML = "";
});

describe("les commandes d'un passage dans l'app native", () => {
  it("montent dans un bottom sheet, commentaires compris", async () => {
    const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/:chemin(.*)*", component: { render: () => null } }],
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    monte = createApp({ render: () => h(ReadingSelectionMenu) });
    monte.use(i18n).use(router).mount(host);
    await router.isReady();

    const el = document.createElement("p");
    document.body.appendChild(el);
    selectPassage({
      key: "1#0#0",
      el,
      hebrew: "בְּרֵאשִׁית",
      place: "Berechit · verset 1",
      url: "https://petitejerusalem.fr/x?verset=0",
      bookmarked: false,
      toggleBookmark: () => {},
      commentary: {
        summary: () => ({ state: "ready", counts: [{ source: "rashi", count: 3 }] }),
        open: () => {},
      },
    });
    await nextTick();
    await nextTick();

    const sheet = host.querySelector<HTMLElement>(".bottom-sheet")!;
    expect(sheet).not.toBeNull();
    expect(host.querySelector(".bubble-anchor")).toBeNull();
    expect(sheet.querySelectorAll(".bubble-action")).toHaveLength(4);
    expect(sheet.querySelector(".bubble-commentary")!.textContent).toContain("Rachi 3");

    // Un appui dans le volet, poignée comprise, ne relâche pas le passage.
    sheet
      .querySelector(".sheet-grip")!
      .dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(readingPassage.value).not.toBeNull();
  });
});
