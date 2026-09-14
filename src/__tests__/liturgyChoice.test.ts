import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";
import en from "../locales/en";
import he from "../locales/he";
import LiturgyText from "../views/TextReading/LiturgyText.vue";
import { parseTefilaBlocks } from "../services/textService";

/**
 * Un choix laissé au lecteur (la haftara de Min'ha d'un jeûne) : les blocs
 * d'une même clé forment une seule section, sous le titre du premier, avec
 * un sélecteur ; seul le texte de l'option prise se lit. Faute d'un choix
 * déjà fait, le jour propose (`preferred`) ; le choix pris est retenu sur
 * l'appareil et vaut d'une page à l'autre.
 */
const BLOCS = parseTefilaBlocks([
  { labelText: { fr: "Avant", en: "Before", he: "לפני" }, lines: [{ he: "לִפְנֵי" }] },
  {
    labelText: { fr: "Haftara", en: "Haftarah", he: "הפטרה" },
    when: "selihot-tsom",
    plain: true,
    choice: {
      key: "haftara-tsom",
      id: "dirchou",
      label: { fr: "Dirchou", en: "Dirshu", he: "דרשו" },
      preferred: "tsom-guedalia",
    },
    halakha: { fr: "Qui lit quoi", en: "Who reads what", he: "מי קורא מה" },
    lines: [{ he: "דִּרְשׁוּ יְהוָה" }],
  },
  {
    when: "selihot-tsom",
    plain: true,
    choice: {
      key: "haftara-tsom",
      id: "chouva",
      label: { fr: "Chouva Israël", en: "Shuva Yisrael", he: "שובה ישראל" },
    },
    halakha: { fr: "Qui lit quoi", en: "Who reads what", he: "מי קורא מה" },
    lines: [{ he: "שׁוּבָה יִשְׂרָאֵל" }],
  },
  {
    when: "selihot-tsom",
    plain: true,
    choice: {
      key: "haftara-tsom",
      id: "aucune",
      label: { fr: "Pas de haftara", en: "No haftarah", he: "בלי הפטרה" },
      preferred: "tsom-tevet|tsom-esther|tsom-tamouz",
    },
    halakha: { fr: "Qui lit quoi", en: "Who reads what", he: "מי קורא מה" },
    lines: [],
  },
  { labelText: { fr: "Après", en: "After", he: "אחרי" }, lines: [{ he: "אַחֲרֵי" }] },
]);

function monter(occasions: Set<string>) {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr, en, he } });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({
    render: () =>
      h(LiturgyText, {
        blocks: BLOCS,
        showPhonetic: false,
        occasions,
        recentChanges: new Set<string>(),
      }),
  });
  app.use(i18n);
  app.mount(host);
  return {
    host,
    hebreu: () => host.textContent!.replace(/\s+/g, " "),
    pressed: () =>
      [...host.querySelectorAll<HTMLButtonElement>(".reading-choice-option")].map((b) =>
        b.getAttribute("aria-pressed"),
      ),
    cliquer: async (index: number) => {
      host.querySelectorAll<HTMLButtonElement>(".reading-choice-option")[index].click();
      await nextTick();
    },
    fermer: () => {
      app.unmount();
      host.remove();
    },
  };
}

describe("un choix laissé au lecteur", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("montre une seule section, avec la note, le sélecteur et l'option du jour", () => {
    const { host, hebreu, pressed, fermer } = monter(new Set(["selihot-tsom", "tsom-guedalia"]));
    // Un seul titre, une seule ancre : celle du premier bloc du choix.
    expect(host.querySelectorAll("[data-block-anchor]")).toHaveLength(3);
    expect([...host.querySelectorAll("[data-block-anchor]")].map((s) => s.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("Haftara")]),
    );
    expect(host.textContent).not.toContain("Chouva IsraëlHaftara");
    // La note précède le sélecteur, qui précède le texte.
    const section = host.querySelectorAll("section")[1];
    const ordre = [...section.querySelectorAll(".reading-halakha, .reading-choice, .reading-he")];
    expect(ordre.map((el) => el.className.split(" ")[0])).toEqual([
      "reading-halakha",
      "reading-choice",
      "reading-he",
    ]);
    expect(section.textContent).toContain("Qui lit quoi");
    expect(section.textContent).toContain("Selon l'usage de votre communauté");
    // À Guedalia, le jour propose « Dirchou » : c'est lui qui se lit.
    expect(pressed()).toEqual(["true", "false", "false"]);
    expect(hebreu()).toContain("דִּרְשׁוּ");
    expect(hebreu()).not.toContain("שׁוּבָה");
    fermer();
  });

  it("propose rien aux trois autres jeûnes, sans perdre la section", () => {
    const { hebreu, pressed, fermer } = monter(new Set(["selihot-tsom", "tsom-tevet"]));
    expect(pressed()).toEqual(["false", "false", "true"]);
    expect(hebreu()).toContain("Qui lit quoi");
    expect(hebreu()).not.toContain("דִּרְשׁוּ");
    expect(hebreu()).not.toContain("שׁוּבָה");
    fermer();
  });

  it("retient le choix pris, d'une page à l'autre", async () => {
    const premiere = monter(new Set(["selihot-tsom", "tsom-guedalia"]));
    await premiere.cliquer(1);
    expect(premiere.pressed()).toEqual(["false", "true", "false"]);
    expect(premiere.hebreu()).toContain("שׁוּבָה");
    expect(premiere.hebreu()).not.toContain("דִּרְשׁוּ");
    premiere.fermer();
    // Une autre page, un autre jour : le choix pris prime sur ce que le jour propose.
    const seconde = monter(new Set(["selihot-tsom", "tsom-tevet"]));
    expect(seconde.pressed()).toEqual(["false", "true", "false"]);
    expect(seconde.hebreu()).toContain("שׁוּבָה");
    seconde.fermer();
  });

  it("garde les options d'un choix au parseur, même vides", () => {
    const options = BLOCS.filter((b) => b.choice);
    expect(options.map((b) => b.choice!.id)).toEqual(["dirchou", "chouva", "aucune"]);
    expect(options[2].lines).toEqual([]);
    expect(options.map((b) => b.labelText?.fr)).toEqual(["Haftara", undefined, undefined]);
  });
});
