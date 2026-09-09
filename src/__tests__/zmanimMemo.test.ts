import { describe, expect, it, vi } from "vitest";
import { Zmanim } from "@hebcal/core";
import { computeZmanim, DEFAULT_PLACE, placeFromCity } from "../services/zmanimService";

/**
 * Les cartes de l'accueil redemandent les horaires du jour à chaque tic de
 * l'horloge partagée : le calcul hebcal ne doit se faire qu'une fois par lieu
 * et par jour civil, et rendre le même résultat.
 */
describe("mémoïsation de computeZmanim", () => {
  it("ne calcule qu'une fois pour le même lieu et le même jour", () => {
    // hebcal appelle sunset() plusieurs fois par calcul (les horaires du soir
    // en dérivent) : on compte donc par différence, pas en valeur absolue.
    const sunset = vi.spyOn(Zmanim.prototype, "sunset");
    const morning = new Date(2026, 7, 7, 9, 0);
    const first = computeZmanim(DEFAULT_PLACE, morning);
    const perComputation = sunset.mock.calls.length;
    expect(perComputation).toBeGreaterThan(0);
    const evening = new Date(2026, 7, 7, 21, 30);
    const again = computeZmanim(DEFAULT_PLACE, evening);

    expect(again).toBe(first);
    expect(first.length).toBeGreaterThan(10);
    expect(sunset).toHaveBeenCalledTimes(perComputation);

    // Un autre jour, ou un autre lieu : un nouveau calcul.
    computeZmanim(DEFAULT_PLACE, new Date(2026, 7, 8, 9, 0));
    expect(sunset).toHaveBeenCalledTimes(2 * perComputation);
    const jerusalem = placeFromCity({
      name: "Jérusalem",
      country: "IL",
      lat: 31.7683,
      lon: 35.2137,
      tz: "Asia/Jerusalem",
    });
    computeZmanim(jerusalem, morning);
    expect(sunset).toHaveBeenCalledTimes(3 * perComputation);
    sunset.mockRestore();
  });
});
