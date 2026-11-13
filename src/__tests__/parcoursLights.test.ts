import { describe, expect, it } from "vitest";
import {
  LIGHTS,
  earnedLights,
  lightOf,
  lightsToCelebrate,
  nextLight,
} from "../services/parcours/lights";

/**
 * Les lumières de la série (services/parcours/lights.ts) : ce qu'on voit
 * suit la série en cours, ce qu'on a gagné suit le record et ne se perd
 * pas, et l'on ne fête que ce qu'on vient de faire.
 */
describe("les lumières de la série", () => {
  it("montent de la lampe à la lumière du premier jour, palier après palier", () => {
    expect(LIGHTS[0]).toEqual({ id: "lamp", from: 0 });
    expect(LIGHTS[LIGHTS.length - 1]).toEqual({ id: "first-light", from: 365 });
    const steps = LIGHTS.map((light) => light.from);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    expect(new Set(steps).size).toBe(steps.length);
  });

  it("suivent la série en cours : le plus haut palier atteint", () => {
    expect(lightOf(0).id).toBe("lamp");
    expect(lightOf(2).id).toBe("lamp");
    expect(lightOf(3).id).toBe("candle");
    expect(lightOf(29).id).toBe("lighthouse");
    expect(lightOf(30).id).toBe("moon");
    expect(lightOf(1000).id).toBe("first-light");
  });

  it("disent la suivante, et plus rien tout en haut", () => {
    expect(nextLight(0)).toEqual({ id: "candle", from: 3 });
    expect(nextLight(7)?.id).toBe("menorah");
    expect(nextLight(365)).toBeNull();
  });

  it("restent gagnées quand la série retombe : le record les garde", () => {
    expect(earnedLights(52).map((light) => light.id)).toEqual([
      "lamp",
      "candle",
      "lantern",
      "menorah",
      "lighthouse",
      "moon",
      "sun",
    ]);
  });

  it("ne se fêtent qu'une fois, quand le record vient de franchir un palier", () => {
    expect(lightsToCelebrate(6, 7).map((light) => light.id)).toEqual(["lantern"]);
    expect(lightsToCelebrate(7, 8)).toEqual([]);
    expect(lightsToCelebrate(7, 7)).toEqual([]);
    // Quelques jours comblés depuis le mur : le palier franchi se fête.
    expect(lightsToCelebrate(12, 14).map((light) => light.id)).toEqual(["menorah"]);
  });

  it("ne fêtent rien quand le record saute d'un coup (le compte relu ailleurs)", () => {
    expect(lightsToCelebrate(0, 40)).toEqual([]);
  });
});
