import { describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";
import ReadingEncadrement from "../components/ReadingEncadrement.vue";
import { encadrementOf } from "../services/encadrementService";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson } from "../models/models";

/**
 * L'encadré d'un passage qui accompagne une lecture : le Yehi ratson des
 * Tehilim, le Léchem yihoud du Cantique des cantiques.
 *
 * Il s'ouvre replié, et c'est le point : ces prières sont longues, et la
 * lecture qu'elles encadrent doit rester la première chose qu'on voit. Un
 * jour où le repli se perdrait (un `v-show` retourné, une transition retirée),
 * la lecture du jour s'ouvrirait sur deux écrans de prière avant le premier
 * psaume, sans qu'aucun autre test ne le voie.
 */

const catalogue = (textStudiesJson as TextStudiesJson).textStudies;
const TEHILIM_1 = catalogue.find((t) => t.id === 103)!;

function mount() {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const blocks = encadrementOf(TEHILIM_1)!.before;
  const app = createApp({
    render: () => h(ReadingEncadrement, { blocks, title: fr.encadrement.before }),
  });
  app.use(i18n);
  app.mount(host);

  const fold = () => host.querySelector("button")!;
  const contenu = () => fold().nextElementSibling as HTMLElement;
  return { host, fold, contenu };
}

describe("encadré d'un passage qui accompagne une lecture", () => {
  it("s'ouvre replié, sous son titre", async () => {
    const { host, fold, contenu } = mount();
    expect(fold().textContent).toContain("Avant la lecture");
    expect(fold().getAttribute("aria-expanded")).toBe("false");
    // Le texte est bien monté (il n'attend aucun chargement), mais masqué.
    expect(host.textContent).toContain("יְהִי רָצוֹן");
    expect(contenu().style.display).toBe("none");
  });

  it("s'ouvre sur le titre, et se referme dessus", async () => {
    const { fold, contenu } = mount();

    fold().dispatchEvent(new MouseEvent("click"));
    await nextTick();
    expect(fold().getAttribute("aria-expanded")).toBe("true");
    expect(contenu().style.display).not.toBe("none");

    fold().dispatchEvent(new MouseEvent("click"));
    await nextTick();
    expect(fold().getAttribute("aria-expanded")).toBe("false");
  });
});
