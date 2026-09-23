import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createApp, h } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";
import LiturgyText from "../views/TextReading/LiturgyText.vue";
import { parseTefilaBlocks } from "../services/textService";

/**
 * Ce qui ne se dit pas partout passe au second plan : la supplique « Chema'
 * koli » avant Min'ha d'un jeûne, le léchem yihoud d'Arvit, la seconde liste
 * du vidouy de la veille de Kippour, que Tunis ne disait pas. Le fichier le
 * marque (`muted`), le lecteur le rend en gris, et c'est ainsi qu'on voit d'un
 * coup d'œil de quel passage parle la note qui le précède.
 *
 * Deux choses à tenir, et la seconde est celle qui a lâché : la classe se pose
 * bien sur le paragraphe, mais le gris ne se voyait pas. `.reading-he` fixait
 * `color: inherit`, une déclaration qui ne fait rien en soi (une couleur
 * s'hérite toute seule) sauf l'emporter, style scopé contre utilitaire, sur la
 * classe posée au même endroit. Tout ce qui devait être au second plan se
 * lisait donc en plein noir, sans qu'aucun test ne le voie.
 */

const SOURCE = resolve(__dirname, "../views/TextReading/LiturgyText.vue");

function paragraphes(lines: unknown[]): HTMLParagraphElement[] {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const blocks = parseTefilaBlocks([{ lines }]);
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
  return [...host.querySelectorAll<HTMLParagraphElement>("p.reading-he")];
}

describe("ce qui ne se dit pas toujours", () => {
  it("passe au second plan, et lui seul", () => {
    const [ordinaire, retrait] = paragraphes([
      "אָבִֽינוּ מַלְכֵּֽנוּ",
      { he: "שְׁמַע קוֹלִי", muted: true },
    ]);
    expect(ordinaire.className).not.toContain("text-text-secondary");
    expect(retrait.className).toContain("text-text-secondary");
  });

  it("n'est pas ramené au premier plan par la couleur du texte hébreu", () => {
    // `.reading-he` ne fixe aucune couleur : elle vient du bloc (le thème pour
    // l'ajout du jour) ou de la classe du paragraphe (le gris du second plan).
    const source = readFileSync(SOURCE, "utf8");
    const regle = /\.reading-he\s*\{([^}]*)\}/.exec(source);
    expect(regle, "la règle .reading-he a disparu ou changé de nom").not.toBeNull();
    expect(regle![1]).not.toMatch(/(^|[\s;])color\s*:/);
  });
});
