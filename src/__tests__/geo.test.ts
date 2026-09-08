import { describe, expect, it } from "vitest";
import { haversineKm } from "../services/geo";
import { distanceToKotelKm } from "../services/kotelDirection";
import { distanceKm } from "../services/nearestCity";

describe("haversineKm", () => {
  it("donne la distance Paris-Jérusalem à quelques kilomètres près", () => {
    const km = haversineKm(48.8534, 2.3488, 31.7683, 35.2137);
    expect(km).toBeGreaterThan(3320);
    expect(km).toBeLessThan(3340);
  });

  it("vaut zéro d'un point à lui-même, et ne dépend pas du sens", () => {
    expect(haversineKm(48.85, 2.35, 48.85, 2.35)).toBe(0);
    expect(haversineKm(48.85, 2.35, 31.77, 35.21)).toBeCloseTo(
      haversineKm(31.77, 35.21, 48.85, 2.35),
      9,
    );
  });

  it("est la seule formule : le Kotel et la ville la plus proche s'en servent", () => {
    expect(distanceToKotelKm(48.8534, 2.3488)).toBeCloseTo(
      haversineKm(48.8534, 2.3488, 31.7767, 35.2345),
      9,
    );
    expect(distanceKm).toBe(haversineKm);
  });
});
