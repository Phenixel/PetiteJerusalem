import { describe, expect, it } from "vitest";
import { countDailyProgress } from "../services/userPreferencesService";

// La règle de comptage de la lecture du jour, partagée entre la page Lecture
// quotidienne et l'accueil (et recopiée dans functions/src/dailyReminder.ts).
describe("countDailyProgress", () => {
  it("compte textes et options quotidiennes, chnei mikra exclu", () => {
    const { done, total } = countDailyProgress({
      textIds: [5, 12],
      options: ["parasha", "tehilim-jour"],
      completedTextIds: ["5"],
      completedOptions: ["tehilim-jour"],
    });
    expect(total).toBe(3); // 2 textes + tehilim-jour ; la paracha est hebdomadaire
    expect(done).toBe(2);
  });

  it("ignore les complétions qui ne sont plus dans les listes actives", () => {
    // Option désactivée (ou texte retiré) après avoir été marquée lue : son
    // entrée résiduelle ne doit pas gonfler le décompte ni annuler le rappel.
    const { done, total } = countDailyProgress({
      textIds: [5],
      options: [],
      completedTextIds: ["9"],
      completedOptions: ["tehilim-jour"],
    });
    expect(total).toBe(1);
    expect(done).toBe(0);
  });

  it("accepte indifféremment ids numériques et chaînes", () => {
    const { done } = countDailyProgress({
      textIds: ["5"],
      options: [],
      completedTextIds: [5],
      completedOptions: [],
    });
    expect(done).toBe(1);
  });
});
