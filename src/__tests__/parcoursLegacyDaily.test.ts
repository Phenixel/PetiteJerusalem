import { describe, expect, it } from "vitest";
import { joiningEntries } from "../services/parcours/account";
import {
  LEGACY_PARASHA_ID,
  LEGACY_TEHILIM_ID,
  importLegacy,
  legacyProjection,
  legacyTextId,
} from "../services/parcours/legacyDailyReading";
import { removeObjective } from "../services/parcours/actions";
import { emptyParcours } from "../services/parcours/model";

/**
 * La lecture du jour d'avant dans Mon parcours
 * (services/parcours/legacyDailyReading.ts), et ce que l'appareil verse dans
 * le compte qui se connecte (services/parcours/account.ts).
 *
 * Ce que ce test tient : les versions déjà installées, les widgets, la montre
 * et le rappel du soir lisent `dailyReadingIds`, `dailyReadingOptions` et
 * `dailyReadingProgress` ; Mon parcours les reprend sans rien perdre, et les
 * réécrit tels qu'ils les attendent.
 */

const TODAY = "2026-10-14"; // un mercredi, semaine du Chabbat 17 octobre

const legacy = {
  ids: [103, 41],
  options: ["tehilim-jour", "parasha"],
  progress: {
    date: TODAY,
    completedIds: [103],
    completedOptions: ["tehilim-jour"],
    parashaProgress: { week: "2026-10-17", completed: true },
  },
};

describe("reprendre la lecture du jour", () => {
  it("donne un objectif par texte et par lecture du moment, et coche ce qui a été lu", () => {
    const data = importLegacy(emptyParcours(), legacy, TODAY, 1);
    expect(Object.keys(data.objectives).sort()).toEqual(
      [legacyTextId(103), legacyTextId(41), LEGACY_TEHILIM_ID, LEGACY_PARASHA_ID].sort(),
    );
    expect(data.days[TODAY].done.sort()).toEqual(
      [legacyTextId(103), LEGACY_TEHILIM_ID, LEGACY_PARASHA_ID].sort(),
    );
  });

  it("ne fait revenir ni un texte retiré, ni un jour passé", () => {
    let data = importLegacy(emptyParcours(), legacy, TODAY, 1);
    data = removeObjective(data, legacyTextId(41), 2);
    const again = importLegacy(
      data,
      { ...legacy, progress: { date: "2026-10-13", completedIds: [41] } },
      TODAY,
      3,
    );
    expect(again.objectives[legacyTextId(41)].deletedAt).toBe(2);
    expect(again.days[TODAY]).toEqual(data.days[TODAY]);
  });

  it("réécrit les champs d'avant tels que les versions installées les lisent", () => {
    const data = importLegacy(emptyParcours(), legacy, TODAY, 1);
    expect(legacyProjection(data, TODAY)).toEqual({
      dailyReadingIds: [41, 103],
      dailyReadingOptions: ["tehilim-jour", "parasha"],
      dailyReadingProgress: {
        date: TODAY,
        completedIds: [103],
        completedOptions: ["tehilim-jour"],
        parashaProgress: { week: "2026-10-17", completed: true },
      },
    });
  });

  it("tient pour lu un texte les jours où il n'est pas prévu", () => {
    const data = importLegacy(emptyParcours(), legacy, TODAY, 1);
    // Berakhot (41), les lundis seulement ; aujourd'hui est un mercredi.
    const id = legacyTextId(41);
    data.objectives[id] = { ...data.objectives[id], days: [1] } as (typeof data.objectives)[string];
    const wednesday = legacyProjection(data, TODAY).dailyReadingProgress;
    expect(wednesday.completedIds).toEqual([41, 103]);
    // Le lundi, il est dû, et pas encore lu.
    const monday = legacyProjection(data, "2026-10-19").dailyReadingProgress;
    expect(monday.completedIds).toEqual([]);
  });
});

describe("ce que l'appareil verse dans le compte", () => {
  const local = emptyParcours();
  local.days["2026-10-12"] = { done: ["a"], at: 100 };
  local.days["2026-10-13"] = { done: ["b"], at: 300 };

  it("tout, sans compte connu ou pour le même compte", () => {
    expect(joiningEntries(local, null, "u1")).toBe(local);
    expect(joiningEntries(local, { uid: "u1", leftAt: 200 }, "u1")).toBe(local);
  });

  it("seulement ce qui a été écrit sans compte, pour un autre compte", () => {
    const joined = joiningEntries(local, { uid: "u1", leftAt: 200 }, "u2");
    expect(Object.keys(joined.days)).toEqual(["2026-10-13"]);
    expect(Object.keys(joiningEntries(local, { uid: "u1" }, "u2").days)).toEqual([]);
  });
});
