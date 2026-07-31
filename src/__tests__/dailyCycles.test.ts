import { describe, it, expect } from "vitest";
import { getWeeklyParasha, getTehilimOfDay, TEHILIM_MONTHLY } from "../services/dailyCycles";

describe("getWeeklyParasha", () => {
  it("résout une paracha du catalogue pour chaque semaine sur 4 ans", () => {
    // Chaque samedi (ou la semaine de fête qui le suit) doit correspondre à
    // une ou deux entrées du catalogue : le mapping hebcal → catalogue est
    // complet, alias compris.
    const start = Date.UTC(2025, 0, 1);
    const end = Date.UTC(2029, 0, 1);
    for (let ts = start; ts < end; ts += 7 * 24 * 3600 * 1000) {
      const parasha = getWeeklyParasha(new Date(ts));
      expect(parasha).not.toBeNull();
      expect(parasha!.weekKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(parasha!.entries.length).toBe(parasha!.names.length);
      expect(parasha!.entries.length).toBeGreaterThanOrEqual(1);
      expect(parasha!.entries.length).toBeLessThanOrEqual(2);
      for (const entry of parasha!.entries) {
        expect(String(entry.type)).toBe("Tanakh");
      }
    }
  });

  it("donne la même paracha toute la semaine (dimanche → samedi)", () => {
    // Semaine ordinaire : 2 au 8 novembre 2025 (dimanche → samedi suivant).
    const reference = getWeeklyParasha(new Date(Date.UTC(2025, 10, 2)));
    for (let day = 3; day <= 8; day++) {
      const parasha = getWeeklyParasha(new Date(Date.UTC(2025, 10, day)));
      expect(parasha?.names).toEqual(reference?.names);
    }
  });
});

describe("cycles de Tehilim", () => {
  it("le cycle mensuel couvre les 150 psaumes sans trou", () => {
    const seen = new Set<number>();
    for (const [from, to] of TEHILIM_MONTHLY) {
      expect(from).toBeLessThanOrEqual(to);
      for (let n = from; n <= to; n++) seen.add(n);
    }
    expect(seen.size).toBe(150);
    expect(TEHILIM_MONTHLY.length).toBe(30);
  });

  it("résout chaque psaume du jour vers une entrée du catalogue", () => {
    // 40 jours consécutifs : couvre un mois hébraïque entier, y compris le
    // cas du mois de 29 jours.
    for (let day = 0; day < 40; day++) {
      const date = new Date(2026, 0, 1 + day);
      const cycle = getTehilimOfDay(date);
      expect(cycle.psalms.length).toBeGreaterThan(0);
      expect(cycle.entries.length).toBe(cycle.psalms.length);
    }
  });

});
