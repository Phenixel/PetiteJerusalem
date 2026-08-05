import { describe, it, expect } from "vitest";
import { distanceKm, nearestCity } from "../services/nearestCity";
import { describeNearby } from "../services/zmanimService";

describe("distanceKm", () => {
  it("mesure une distance connue", () => {
    // Paris ↔ Jérusalem : ~3 330 km à vol d'oiseau.
    const km = distanceKm(48.8534, 2.3488, 31.7683, 35.2137);
    expect(km).toBeGreaterThan(3300);
    expect(km).toBeLessThan(3360);
  });

  it("annule la distance d'un point à lui-même", () => {
    expect(distanceKm(48.8534, 2.3488, 48.8534, 2.3488)).toBe(0);
  });
});

describe("nearestCity", () => {
  it("reconnaît la ville où l'on se trouve", () => {
    // Quelque part dans Sarcelles.
    const nearby = nearestCity(48.9974, 2.3782);
    expect(nearby?.city).toBe("Sarcelles");
    expect(nearby?.country).toBe("FR");
    expect(nearby?.km).toBeLessThan(5);
  });

  it("trouve la ville la plus proche depuis les environs", () => {
    // Bord de mer entre Tel-Aviv et Haïfa.
    const nearby = nearestCity(32.34, 34.85);
    expect(nearby).not.toBeNull();
    expect(nearby!.country).toBe("IL");
  });

  it("ne nomme rien en plein océan", () => {
    expect(nearestCity(-30, -140)).toBeNull();
  });
});

describe("describeNearby", () => {
  const at = (km: number) => describeNearby({ city: "Lyon", country: "FR", km });

  it("donne la ville quand on y est", () => {
    expect(at(3)).toEqual({ kind: "city", city: "Lyon" });
    expect(at(25)).toEqual({ kind: "city", city: "Lyon" });
  });

  it("reste prudent à quelques dizaines de kilomètres", () => {
    expect(at(60)).toEqual({ kind: "near", city: "Lyon" });
    expect(at(150)).toEqual({ kind: "near", city: "Lyon" });
  });

  it("ne donne plus que le pays quand la ville est loin", () => {
    expect(at(400)).toEqual({ kind: "country", country: "FR" });
  });

  it("ne nomme rien sans ville proche connue", () => {
    expect(at(2000)).toEqual({ kind: "unknown" });
    expect(describeNearby(null)).toEqual({ kind: "unknown" });
    expect(describeNearby(undefined)).toEqual({ kind: "unknown" });
  });
});

describe("noms de pays", () => {
  it("se traduisent dans la langue de l'interface", () => {
    expect(new Intl.DisplayNames(["fr"], { type: "region" }).of("FR")).toBe("France");
    expect(new Intl.DisplayNames(["en"], { type: "region" }).of("IL")).toBe("Israel");
  });
});
