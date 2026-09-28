import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";
import en from "../locales/en";
import he from "../locales/he";
import LiturgyText from "../views/TextReading/LiturgyText.vue";
import { parseTefilaBlocks } from "../services/textService";

/**
 * La 'hazara : à la fin d'une 'Amida que le 'hazan répète, le bouton remonte
 * au titre de cette 'Amida et déplie les passages du 'hazan qu'elle contient,
 * repliés tant qu'on prie à voix basse. Ceux du 'hazan hors de la 'Amida (le
 * Kaddich qui la précède, celui qui la suit) restent repliés.
 */
const R = (fr: string) => ({ fr, en: fr, he: fr });
const BLOCS = parseTefilaBlocks([
  { labelText: R("Demi-Kaddich"), fold: "hazan", lines: [{ he: "יִתְגַּדַּל" }] },
  { labelText: R("'Amida"), kotel: true, lines: [{ he: "בָּרוּךְ אַתָּה" }] },
  { labelText: R("Kedoucha"), fold: "hazan", lines: [{ he: "נְקַדֵּשׁ" }] },
  { lines: [{ he: "אַתָּה קָדוֹשׁ" }] },
  { labelText: R("Modim dérabanan"), fold: "hazan", lines: [{ he: "מוֹדִים" }] },
  { hazara: true, lines: [{ he: "עֹשֶׂה שָׁלוֹם בִּמְרוֹמָיו" }] },
  { labelText: R("Kaddich Titkabal"), fold: "hazan", lines: [{ he: "תִּתְקַבַּל" }] },
]);

function monter(blocks = BLOCS) {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr, en, he } });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({
    render: () =>
      h(LiturgyText, {
        blocks,
        showPhonetic: false,
        occasions: new Set<string>(),
        recentChanges: new Set<string>(),
      }),
  });
  app.use(i18n);
  app.mount(host);
  const encadres = () =>
    Object.fromEntries(
      [...host.querySelectorAll<HTMLButtonElement>("button[aria-expanded]")].map((b) => [
        b.textContent!.trim(),
        b.getAttribute("aria-expanded"),
      ]),
    );
  const bouton = () =>
    [...host.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => b.textContent!.trim() === "'Hazara",
    );
  return {
    encadres,
    bouton,
    fermer: () => {
      app.unmount();
      host.remove();
    },
  };
}

describe("le bouton de la 'hazara", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("se pose à la fin de la 'Amida, les passages du 'hazan repliés", () => {
    const { bouton, encadres, fermer } = monter();
    expect(bouton()).toBeDefined();
    expect(Object.values(encadres())).toEqual(["false", "false", "false", "false"]);
    fermer();
  });

  it("déplie les passages du 'hazan de la 'Amida, et remonte à son titre", async () => {
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    // jsdom ne connaît pas CSS.escape, dont se sert la remontée à l'ancre.
    vi.stubGlobal("CSS", { escape: (value: string) => value });
    const { bouton, encadres, fermer } = monter();
    bouton()!.click();
    await nextTick();
    expect(encadres()).toEqual({
      "Demi-Kaddich": "false",
      Kedoucha: "true",
      "Modim dérabanan": "true",
      "Kaddich Titkabal": "false",
    });
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));
    fermer();
  });

  it("ne se pose pas sans 'Amida au-dessus de lui", () => {
    const { bouton, fermer } = monter(BLOCS.filter((b) => !b.kotel));
    expect(bouton()).toBeUndefined();
    fermer();
  });
});
