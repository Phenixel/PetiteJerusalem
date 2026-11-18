import { describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";

/**
 * The bold openings of the guemara (« מתני׳ », « גמ׳ » and the word after)
 * are worked out once per text. Called from the template, they were
 * re-tokenized for every passage on every render (each tap, selection or
 * bookmark), and every passage re-rendered with a new array of words.
 */

const { talmudOpenings } = vi.hoisted(() => ({ talmudOpenings: vi.fn() }));
vi.mock("../services/pageForm", async (importOriginal) => {
  const real = await importOriginal<typeof import("../services/pageForm")>();
  talmudOpenings.mockImplementation(real.talmudOpenings);
  return { ...real, talmudOpenings };
});

import TalmudDafText from "../components/TalmudDafText.vue";

describe("the openings of a guemara", () => {
  it("are not worked out again when a passage is selected", async () => {
    const blocks = [
      { daf: "2a", amud: 0, lines: ["מתני׳ מאימתי קורין", "גמ׳ תנא היכא קאי", "ועוד"] },
      { daf: "2b", amud: 1, lines: ["מתני׳ שנה", "גמ׳ אמר"] },
    ];
    const selected = ref<number | null>(null);
    const app = createApp({
      render: () => h(TalmudDafText, { blocks, selectable: true, selectedLine: selected.value }),
    });
    app.use(createI18n({ legacy: false, locale: "fr", messages: { fr } }));
    app.mount(document.createElement("div"));
    await nextTick();
    const first = talmudOpenings.mock.calls.length;
    expect(first).toBe(5);

    selected.value = 1;
    await nextTick();
    selected.value = 3;
    await nextTick();
    expect(talmudOpenings.mock.calls.length).toBe(first);
    app.unmount();
  });
});
