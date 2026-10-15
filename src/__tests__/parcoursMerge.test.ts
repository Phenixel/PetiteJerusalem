import { describe, expect, it } from "vitest";
import { changedEntries, mergeParcours, parseParcours } from "../services/parcours/merge";
import { emptyParcours } from "../services/parcours/model";
import type { Objective } from "../services/parcours/model";

/**
 * La fusion de Mon parcours d'un appareil à l'autre (services/parcours/merge.ts).
 *
 * Deux règles de compatibilité y sont tenues. Entrée par entrée, la plus
 * récente gagne, retrait compris : un objectif retiré sur le téléphone ne
 * revient pas de l'ordinateur. Et une version de l'app lit des données plus
 * récentes que son code sans rien en perdre : une sorte d'objectif qu'elle ne
 * connaît pas reste dans les données.
 */

const habit = (updatedAt: number, extra: Partial<Objective> = {}): Objective =>
  ({
    id: "h",
    kind: "habit",
    preset: "tefilin",
    name: "",
    days: [0],
    since: "2026-10-11",
    moment: "morning",
    createdAt: 1,
    updatedAt,
    ...extra,
  }) as Objective;

describe("la fusion", () => {
  it("garde, entrée par entrée, la plus récente", () => {
    const phone = emptyParcours();
    phone.objectives.h = habit(10, { deletedAt: 10 });
    phone.days["2026-10-12"] = { done: ["h"], at: 5 };
    const laptop = emptyParcours();
    laptop.objectives.h = habit(8);
    laptop.days["2026-10-12"] = { done: [], at: 7 };
    laptop.days["2026-10-13"] = { done: ["h"], at: 9 };

    const merged = mergeParcours(phone, laptop);
    expect(merged.objectives.h.deletedAt).toBe(10);
    expect(merged.days["2026-10-12"]).toEqual({ done: [], at: 7 });
    expect(merged.days["2026-10-13"].done).toEqual(["h"]);
  });

  it("dit quelles entrées écrire", () => {
    const before = emptyParcours();
    before.objectives.h = habit(1);
    const after = mergeParcours(before, {
      ...emptyParcours(),
      days: { "2026-10-12": { done: ["h"], at: 2 } },
    });
    expect(changedEntries(before, after)).toEqual({ objectives: [], days: ["2026-10-12"] });
  });
});

describe("la lecture", () => {
  it("écarte ce qui est illisible sans faire tomber le reste", () => {
    const parsed = parseParcours({
      v: 1,
      objectives: { h: habit(1), bad: { id: "autre" }, nul: null },
      days: {
        "2026-10-12": { done: ["h"], at: 1 },
        hier: { done: [], at: 1 },
        "2026-10-13": { at: 1 },
      },
    });
    expect(Object.keys(parsed.objectives)).toEqual(["h"]);
    expect(Object.keys(parsed.days)).toEqual(["2026-10-12"]);
  });

  it("garde une sorte d'objectif venue d'une version plus récente", () => {
    const future = { ...habit(1), id: "x", kind: "defi" };
    const parsed = parseParcours({ objectives: { x: future }, days: {} });
    expect(parsed.objectives.x).toEqual(future);
  });

  it("rend des données vides pour ce qui n'en est pas", () => {
    expect(parseParcours(null)).toEqual(emptyParcours());
    expect(parseParcours("[]")).toEqual(emptyParcours());
  });
});
