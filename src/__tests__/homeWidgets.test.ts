import { describe, expect, it } from "vitest";
import {
  availableHomeWidgets,
  DEFAULT_HOME_WIDGETS,
  HOME_WIDGET_ICONS,
  HOME_WIDGET_KEYS,
  homeWidgetsToSave,
  MAX_HOME_WIDGETS,
  moveHomeWidget,
  resolveHomeWidgets,
  sameHomeWidgets,
} from "../services/homeWidgets";
import fr from "../locales/fr";
import en from "../locales/en";
import he from "../locales/he";

// Les widgets de l'accueil (voir services/homeWidgets et docs/design.md,
// « L'accueil se compose »).
describe("homeWidgets", () => {
  it("garde l'accueil d'origine à qui n'a rien réglé", () => {
    expect(resolveHomeWidgets(undefined)).toEqual(["daily_reading", "zmanim"]);
    expect(resolveHomeWidgets(null)).toEqual([...DEFAULT_HOME_WIDGETS]);
    expect(resolveHomeWidgets("zmanim")).toEqual([...DEFAULT_HOME_WIDGETS]);
  });

  it("respecte une liste vide : c'est un choix", () => {
    expect(resolveHomeWidgets([])).toEqual([]);
  });

  it("suit l'ordre du compte, sans doublons ni clés inconnues", () => {
    expect(
      resolveHomeWidgets(["zmanim", "widget_du_futur", "daily_reading", "zmanim", 42]),
    ).toEqual(["zmanim", "daily_reading"]);
  });

  it("n'efface jamais une clé écrite par une version plus récente", () => {
    // L'app à jour sur un autre appareil retrouve son widget, même quand une
    // version plus ancienne a réordonné la liste entre-temps.
    const stored = ["daily_reading", "widget_du_futur", "zmanim"];
    expect(homeWidgetsToSave(["zmanim", "daily_reading"], stored)).toEqual([
      "zmanim",
      "daily_reading",
      "widget_du_futur",
    ]);
    expect(homeWidgetsToSave(["zmanim"], undefined)).toEqual(["zmanim"]);
  });

  it("borne la liste enregistrée", () => {
    const many = Array.from({ length: 40 }, (_, i) => `futur_${i}`);
    expect(homeWidgetsToSave([...HOME_WIDGET_KEYS], many)).toHaveLength(MAX_HOME_WIDGETS);
  });

  it("propose à l'ajout ce qui n'est pas affiché, dans l'ordre du catalogue", () => {
    expect(availableHomeWidgets(["zmanim", "daily_reading"])).toEqual(
      HOME_WIDGET_KEYS.filter((key) => key !== "zmanim" && key !== "daily_reading"),
    );
  });

  it("déplace d'un cran, sans effet au bord", () => {
    const list = ["daily_reading", "zmanim", "month"] as const;
    expect(moveHomeWidget(list, 2, -1)).toEqual(["daily_reading", "month", "zmanim"]);
    expect(moveHomeWidget(list, 0, 1)).toEqual(["zmanim", "daily_reading", "month"]);
    expect(moveHomeWidget(list, 0, -1)).toEqual([...list]);
    expect(moveHomeWidget(list, 2, 1)).toEqual([...list]);
  });

  it("compare deux listes dans l'ordre", () => {
    expect(sameHomeWidgets(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameHomeWidgets(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameHomeWidgets(["a"], ["a", "b"])).toBe(false);
  });

  it("donne à chaque widget un dessin, un nom et une description dans les trois langues", () => {
    for (const key of HOME_WIDGET_KEYS) {
      expect(HOME_WIDGET_ICONS[key]).toBeTruthy();
      for (const messages of [fr, en, he]) {
        const widget = (
          messages.home.widgets.catalog as Record<string, { name: string; description: string }>
        )[key];
        // La clé dans l'objet comparé : un échec dit quel widget manque.
        expect({ key, ...widget }).toEqual({
          key,
          name: expect.stringMatching(/\S/),
          description: expect.stringMatching(/\S/),
        });
      }
    }
  });
});
