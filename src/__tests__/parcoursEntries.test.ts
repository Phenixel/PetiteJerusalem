import { describe, expect, it } from "vitest";
import { taskEntries } from "../services/parcours/entries";
import type { Objective } from "../services/parcours/model";
import type { SlotState } from "../services/parcours/plan";
import type { Task } from "../services/parcours/schedule";

/**
 * Ce qu'une tâche fait lire (services/parcours/entries.ts) : les textes que
 * Ma journée propose de télécharger, pour qu'elle se lise sans connexion. La
 * lecture du jour d'avant proposait la même chose pour sa liste.
 */

const DAY = "2026-10-14";
const base = { createdAt: 0, updatedAt: 0, since: DAY, moment: "evening" as const };

function task(objective: Objective, slot?: Partial<SlotState>): Task {
  return {
    id: objective.id,
    objectiveId: objective.id,
    kind: objective.kind,
    moment: objective.moment,
    weekly: false,
    slot: slot as SlotState | undefined,
  };
}

const ids = (entries: { id: number | string }[]) => entries.map((entry) => Number(entry.id));

describe("les textes d'une tâche", () => {
  // Un programme sur deux traités de Nezikin : 77 (50 michnayot), puis Avot (78).
  const program: Objective = {
    ...base,
    id: "p",
    kind: "program",
    corpus: "michna",
    parts: ["text:77", "text:78"],
    texts: [77, 78],
    total: 158,
    rhythm: "daily",
    end: "2027-10-01",
    base: { day: DAY, position: 0 },
  };

  it("une portion à cheval sur deux traités les demande tous les deux", () => {
    expect(ids(taskEntries(task(program, { from: 48, to: 52 }), program, DAY, false))).toEqual([
      77, 78,
    ]);
  });

  it("une portion dans un seul traité ne demande que lui", () => {
    expect(ids(taskEntries(task(program, { from: 60, to: 64 }), program, DAY, false))).toEqual([
      78,
    ]);
  });

  it("un texte du jour se demande lui-même", () => {
    const text: Objective = {
      ...base,
      id: "t",
      kind: "text",
      textId: 103,
      days: [0, 1, 2, 3, 4, 5, 6],
    };
    expect(ids(taskEntries(task(text), text, DAY, false))).toEqual([103]);
  });

  it("les lectures du calendrier demandent les psaumes du jour, ou la paracha", () => {
    const tehilim: Objective = { ...base, id: "c", kind: "cycle", cycle: "tehilim-month" };
    expect(taskEntries(task(tehilim), tehilim, DAY, false).length).toBeGreaterThan(0);
    const parasha: Objective = { ...base, id: "c2", kind: "cycle", cycle: "parasha" };
    expect(taskEntries(task(parasha), parasha, DAY, false).length).toBeGreaterThan(0);
  });

  it("une habitude n'a rien à télécharger", () => {
    const habit: Objective = {
      ...base,
      id: "h",
      kind: "habit",
      preset: "tefilin",
      name: "",
      days: [0, 1, 2, 3, 4, 5],
    };
    expect(taskEntries(task(habit), habit, DAY, false)).toEqual([]);
  });
});
