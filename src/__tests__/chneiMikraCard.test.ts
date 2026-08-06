import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";
import ChneiMikraCard from "../components/ChneiMikraCard.vue";

/**
 * Le chnei mikra en tête du Tanakh : il annonce la paracha de la semaine en
 * cours, et ses flèches feuillettent les parachiot sans qu'on se perde.
 */

/** Mercredi 4 février 2026 : la semaine de Yitro (Chabbat 7 février). */
const WEDNESDAY = new Date(2026, 1, 4, 12);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(WEDNESDAY);
});

afterEach(() => vi.useRealTimers());

function mount() {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({ render: () => h(ChneiMikraCard) });
  app.use(i18n);
  app.mount(host);

  const text = () => (host.textContent ?? "").replace(/\s+/g, " ").trim();
  const arrow = (label: string) =>
    [...host.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === label)!;
  const click = async (el: Element) => {
    el.dispatchEvent(new MouseEvent("click"));
    await nextTick();
  };
  return { host, text, arrow, click };
}

describe("ChneiMikraCard", () => {
  it("annonce la paracha de la semaine et son Chabbat", async () => {
    const card = mount();
    await nextTick();

    expect(card.text()).toContain("Chnei mikra");
    expect(card.text()).toContain("Yitro");
    expect(card.text()).toContain("Lue Chabbat 7 février");
    // On est sur la semaine en cours : rien à quoi revenir.
    expect(card.text()).not.toContain("Revenir à la paracha de cette semaine");
  });

  it("feuillette les parachiot dans les deux sens", async () => {
    const card = mount();
    await nextTick();

    await card.click(card.arrow("Paracha suivante"));
    expect(card.text()).toContain("Mishpatim");
    expect(card.text()).toContain("Lue Chabbat 14 février");
    // Parti de la semaine en cours : le retour est proposé.
    expect(card.text()).toContain("Revenir à la paracha de cette semaine");

    await card.click(card.arrow("Paracha précédente"));
    await card.click(card.arrow("Paracha précédente"));
    expect(card.text()).toContain("Beshalach");
  });

  it("ramène à la semaine en cours", async () => {
    const card = mount();
    await nextTick();
    await card.click(card.arrow("Paracha suivante"));
    await card.click(card.arrow("Paracha suivante"));

    const back = [...card.host.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Revenir à la paracha de cette semaine"),
    )!;
    await card.click(back);

    expect(card.text()).toContain("Yitro");
    expect(card.text()).not.toContain("Revenir à la paracha de cette semaine");
  });
});
