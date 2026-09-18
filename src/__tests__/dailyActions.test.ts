import { describe, expect, it } from "vitest";
import {
  activeActionKeys,
  DAILY_ACTION_KEYS,
  DAILY_ACTIONS,
  isDailyActionKey,
  MAX_GOAL_LABEL_LENGTH,
  newGoalId,
  normalizeGoalLabel,
} from "../services/dailyActions";
import { countDailyProgress, mergeDailyProgress } from "../services/userPreferencesService";

/**
 * Les actions du jour et les objectifs personnels : ils se cochent comme une
 * lecture, comptent comme elle, et se fusionnent comme elle hors ligne.
 */
describe("dailyActions", () => {
  it("propose chaque action une fois, avec ses textes", () => {
    expect(DAILY_ACTIONS.map((a) => a.key)).toEqual([...DAILY_ACTION_KEYS]);
    for (const action of DAILY_ACTIONS) {
      expect(action.titleKey).toMatch(/^dailyReading\.actions\./);
      expect(action.descriptionKey).toMatch(/^dailyReading\.actions\./);
    }
    // Les trois offices mènent à leur texte du sidour.
    expect(DAILY_ACTIONS.find((a) => a.key === "chaharit")?.path).toBe(
      "/bibliotheque/sidour/chaharit",
    );
  });

  it("range les actions dans l'ordre proposé, puis les objectifs par création", () => {
    const keys = activeActionKeys(
      ["tsedaka", "chaharit"],
      [
        { id: "g-2", label: "Moussar", createdAt: 2 },
        { id: "g-1", label: "Appeler mes parents", createdAt: 1 },
      ],
    );
    expect(keys).toEqual(["chaharit", "tsedaka", "g-1", "g-2"]);
  });

  it("distingue une clé d'action d'un id d'objectif", () => {
    expect(isDailyActionKey("minha")).toBe(true);
    expect(isDailyActionKey("g-abc")).toBe(false);
    expect(newGoalId()).toMatch(/^g-[a-z0-9-]+$/);
    expect(newGoalId()).not.toBe(newGoalId());
  });

  it("nettoie et borne le libellé d'un objectif", () => {
    expect(normalizeGoalLabel("  dix   minutes de moussar ")).toBe("dix minutes de moussar");
    expect(normalizeGoalLabel("   ")).toBe("");
    expect(normalizeGoalLabel("a".repeat(200))).toHaveLength(MAX_GOAL_LABEL_LENGTH);
  });
});

describe("countDailyProgress avec les actions", () => {
  it("compte actions et objectifs comme des lectures", () => {
    const { done, total } = countDailyProgress({
      textIds: [5],
      options: ["tehilim-jour"],
      completedTextIds: [5],
      completedOptions: [],
      actions: ["chaharit", "g-1"],
      completedActions: ["g-1", "arvit"],
    });
    // 1 texte + 1 option + 2 actions ; « arvit » n'est plus choisie, elle ne compte pas.
    expect(total).toBe(4);
    expect(done).toBe(2);
  });

  it("garde le décompte d'avant sans actions", () => {
    const { done, total } = countDailyProgress({
      textIds: [5, 12],
      options: [],
      completedTextIds: [5],
      completedOptions: [],
    });
    expect(total).toBe(2);
    expect(done).toBe(1);
  });
});

describe("mergeDailyProgress avec les actions et la série", () => {
  it("réunit les actions cochées des deux côtés", () => {
    const merged = mergeDailyProgress(
      { date: "2026-09-18", completedIds: [], completedActions: ["chaharit"] },
      { date: "2026-09-18", completedIds: [], completedActions: ["g-1"] },
    );
    expect(merged.completedActions).toEqual(["chaharit", "g-1"]);
  });

  it("garde la série la plus récente, quel que soit le jour retenu", () => {
    const merged = mergeDailyProgress(
      {
        date: "2026-09-18",
        completedIds: [],
        streak: { current: 2, best: 8, lastDate: "2026-09-17" },
      },
      {
        date: "2026-09-17",
        completedIds: [5],
        streak: { current: 3, best: 3, lastDate: "2026-09-18" },
      },
    );
    expect(merged.date).toBe("2026-09-18");
    expect(merged.streak).toEqual({ current: 3, best: 8, lastDate: "2026-09-18" });
  });
});
