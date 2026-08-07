import { describe, expect, it } from "vitest";
import { mergeDailyProgress } from "../services/userPreferencesService";

/**
 * Fusion du suivi de lecture entre le serveur et ce qui a été coché hors
 * connexion. La règle tient en une phrase : c'est le « lu » qui gagne.
 */
describe("mergeDailyProgress", () => {
  it("additionne les lectures du même jour", () => {
    const merged = mergeDailyProgress(
      { date: "2026-08-07", completedIds: [5] },
      { date: "2026-08-07", completedIds: [12] },
    );
    expect(merged.completedIds).toEqual([5, 12]);
  });

  it("garde une lecture que le serveur connaît, même décochée hors ligne", () => {
    // Personne ne décoche vraiment : perdre une lecture faite serait pire.
    const merged = mergeDailyProgress(
      { date: "2026-08-07", completedIds: [5, 12] },
      { date: "2026-08-07", completedIds: [5] },
    );
    expect(merged.completedIds).toEqual([5, 12]);
  });

  it("réunit les chapitres lus texte par texte", () => {
    const merged = mergeDailyProgress(
      { date: "2026-08-07", completedIds: [], completedSections: { "3": [1, 2] } },
      { date: "2026-08-07", completedIds: [], completedSections: { "3": [2, 5], "9": [1] } },
    );
    expect(merged.completedSections).toEqual({ "3": [1, 2, 5], "9": [1] });
  });

  it("réunit les lectures du moment cochées", () => {
    const merged = mergeDailyProgress(
      { date: "2026-08-07", completedIds: [], completedOptions: ["tehilim-jour"] },
      { date: "2026-08-07", completedIds: [], completedOptions: [] },
    );
    expect(merged.completedOptions).toEqual(["tehilim-jour"]);
  });

  it("retient le jour le plus récent quand la coupure a passé minuit", () => {
    const merged = mergeDailyProgress(
      { date: "2026-08-06", completedIds: [5] },
      { date: "2026-08-07", completedIds: [12] },
    );
    expect(merged.date).toBe("2026-08-07");
    expect(merged.completedIds).toEqual([12]);
  });

  it("accepte un suivi absent d'un côté", () => {
    expect(mergeDailyProgress(undefined, { date: "2026-08-07", completedIds: [12] }).completedIds)
      .toEqual([12]);
    expect(
      mergeDailyProgress({ date: "", completedIds: [] }, { date: "2026-08-07", completedIds: [12] })
        .date,
    ).toBe("2026-08-07");
    expect(mergeDailyProgress({ date: "2026-08-07", completedIds: [5] }, undefined).completedIds)
      .toEqual([5]);
  });

  it("garde le chnei mikra lu de la semaine, quel que soit le jour retenu", () => {
    const merged = mergeDailyProgress(
      { date: "2026-08-06", completedIds: [], parashaProgress: { week: "2026-08-08", completed: true } },
      { date: "2026-08-07", completedIds: [], parashaProgress: { week: "2026-08-08", completed: false } },
    );
    // Le jour le plus récent l'emporte, mais la lecture de la semaine tient.
    expect(merged.date).toBe("2026-08-07");
    expect(merged.parashaProgress).toEqual({ week: "2026-08-08", completed: true });
  });

  it("passe à la nouvelle paracha quand la semaine a changé", () => {
    const merged = mergeDailyProgress(
      { date: "2026-08-07", completedIds: [], parashaProgress: { week: "2026-08-01", completed: true } },
      { date: "2026-08-07", completedIds: [], parashaProgress: { week: "2026-08-08", completed: false } },
    );
    expect(merged.parashaProgress).toEqual({ week: "2026-08-08", completed: false });
  });
});
