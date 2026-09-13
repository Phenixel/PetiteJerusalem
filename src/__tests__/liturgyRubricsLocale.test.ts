import { describe, expect, it } from "vitest";
import { createApp, h } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";
import en from "../locales/en";
import he from "../locales/he";
import LiturgyText from "../views/TextReading/LiturgyText.vue";
import { parseTefilaBlocks } from "../services/textService";
import type { SupportedLocale } from "../i18n";

/**
 * Les didascalies d'une tefila se lisent dans la langue du lecteur : celle
 * au-dessus d'un paragraphe (`rubric`), celle glissée dans le fil du texte
 * (`r`), la halakha du passage (`halakha`) et le titre du bloc (`labelText`).
 * Toutes sont portées par le fichier dans les trois langues, et c'est la
 * langue de l'interface qui choisit ; un fichier qui n'aurait qu'un français
 * retomberait sur lui plutôt que d'afficher du vide.
 *
 * Le bloc ci-dessous en porte une de chaque sorte, avec une halakha et un
 * fragment conditionnels, pour que le rendu de chaque langue soit vérifié
 * sur ce que le jour affiche vraiment.
 */
const BLOCS = parseTefilaBlocks([
  {
    labelText: { fr: "Titre FR", en: "Title EN", he: "כותרת" },
    halakha: [
      { fr: "Halakha FR", en: "Halakha EN", he: "הלכה" },
      { fr: "Halakha techouva FR", en: "Halakha teshuva EN", he: "הלכה תשובה", when: "teshuva" },
    ],
    lines: [
      {
        rubric: { fr: "Didascalie FR", en: "Rubric EN", he: "הוראה" },
        he: [
          "בָּרוּךְ אַתָּה",
          { r: { fr: "(en ligne FR)", en: "(inline EN)", he: "(בשורה)" }, when: "teshuva" },
          { v: "הַמֶּלֶךְ", when: "teshuva" },
          { he: "הָאֵל", when: "!teshuva" },
        ],
      },
    ],
  },
]);

function rendu(locale: SupportedLocale, occasions: Set<string>): string {
  const i18n = createI18n({ legacy: false, locale, messages: { fr, en, he } });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp({
    render: () =>
      h(LiturgyText, {
        blocks: BLOCS,
        showPhonetic: false,
        occasions,
        recentChanges: new Set<string>(),
        highlightedLine: null,
        selectedLine: null,
        isBookmarked: () => false,
      }),
  });
  app.use(i18n);
  app.mount(host);
  const texte = host.textContent ?? "";
  app.unmount();
  host.remove();
  return texte;
}

describe("didascalies dans la langue du lecteur", () => {
  const teshuva = new Set(["teshuva"]);

  it.each<[SupportedLocale, string[]]>([
    ["fr", ["Titre FR", "Halakha FR", "Halakha techouva FR", "Didascalie FR", "(en ligne FR)"]],
    ["en", ["Title EN", "Halakha EN", "Halakha teshuva EN", "Rubric EN", "(inline EN)"]],
    ["he", ["כותרת", "הלכה", "הלכה תשובה", "הוראה", "(בשורה)"]],
  ])("en %s, chaque sorte de didascalie suit la langue", (locale, attendus) => {
    const texte = rendu(locale, teshuva);
    for (const attendu of attendus) expect(texte).toContain(attendu);
    // Et rien des deux autres langues.
    const autres = ["Titre FR", "Title EN", "כותרת"].filter((t) => !attendus.includes(t));
    for (const autre of autres) expect(texte).not.toContain(autre);
  });

  it("n'affiche que les didascalies du jour, quelle que soit la langue", () => {
    const ordinaire = rendu("en", new Set<string>());
    expect(ordinaire).toContain("Halakha EN");
    expect(ordinaire).not.toContain("Halakha teshuva EN");
    expect(ordinaire).not.toContain("(inline EN)");
    expect(ordinaire).toContain("הָאֵל");
    expect(ordinaire).not.toContain("הַמֶּלֶךְ");
  });
});
