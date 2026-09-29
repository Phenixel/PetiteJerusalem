// @vitest-environment node
import { describe, expect, it } from "vitest";
import { transliterate } from "../services/hebrewTransliteration";

/**
 * La phonétique lit ce qui se dit, pas ce qui s'écrit : le Nom se dit
 * « Adonaï », quelle que soit sa graphie, et jamais « yehova » ni « yeo ».
 */
describe("transliterate : le Nom", () => {
  it("lit le Nom « Adonaï », holam sur le hé ou sur le vav", () => {
    expect(transliterate("בָּרוּךְ אַתָּה יְהֹוָה אֱלֹהֵינוּ")).toBe("baroukh ata Adonaï elohénou");
    expect(transliterate("יְהוָֹה")).toBe("Adonaï");
    expect(transliterate("כִּי יְיָ")).toBe("ki Adonaï");
  });

  it("lit les préfixes devant le Nom", () => {
    expect(transliterate("הוֹד֣וּ לַיהֹוָ֣ה כִּי־ט֑וֹב")).toBe("hodou ladonaï ki-tov");
    expect(transliterate("בַּיהֹוָה")).toBe("badonaï");
    expect(transliterate("אֶת־יְהֹוָה")).toBe("et-Adonaï");
  });

  it("lit « Elohim » le Nom vocalisé d'un hiriq, après Adonaï", () => {
    expect(transliterate("אֲדֹנָי יֱהֹוִה")).toBe("adonaï Elohim");
  });

  it("laisse lettre à lettre les combinaisons de méditation", () => {
    expect(transliterate("יִהִוִהִ")).not.toContain("Adonaï");
  });

  it("fait entendre le yod qui ferme un mot après un « a »", () => {
    expect(transliterate("אֲדֹנָי שְׂפָתַי")).toBe("adonaï sefataï");
  });
});
