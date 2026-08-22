import { describe, expect, it } from "vitest";
import { currentTefilaWindow, tefilaPath } from "../services/sidourService";
import { DEFAULT_PLACE } from "../services/zmanimService";

/**
 * La plage horaire de l'office en cours (le raccourci de l'accueil) : les
 * heures sont construites en UTC pour ne pas dépendre du fuseau de la machine
 * de test. À Paris le 15 juin 2026 (UTC+2) : misheyakir vers 3 h 50,
 * 'hatsot vers 13 h 50, min'ha guedola vers 14 h 30, chkia vers 21 h 55,
 * sortie des étoiles vers 22 h 35, 'hatsot de la nuit vers 1 h 50.
 */
const paris = (utcHour: number, utcMinute = 0, day = 15) =>
  new Date(Date.UTC(2026, 5, day, utcHour, utcMinute));

describe("plage horaire de l'office en cours", () => {
  it("le matin : Cha'harit", () => {
    const window = currentTefilaWindow(DEFAULT_PLACE, paris(7, 0)); // 9 h 00
    expect(window?.tefila).toBe("chaharit");
  });

  it("l'après-midi : Min'ha", () => {
    const window = currentTefilaWindow(DEFAULT_PLACE, paris(15, 0)); // 17 h 00
    expect(window?.tefila).toBe("minha");
  });

  it("le soir, après la sortie des étoiles : Arvit", () => {
    const window = currentTefilaWindow(DEFAULT_PLACE, paris(21, 30)); // 23 h 30
    expect(window?.tefila).toBe("arvit");
  });

  it("après minuit, l'Arvit de la nuit en cours (horaires de la veille)", () => {
    const window = currentTefilaWindow(DEFAULT_PLACE, paris(22, 30)); // 0 h 30 le 16
    expect(window?.tefila).toBe("arvit");
  });

  it("entre la chkia et la sortie des étoiles : aucun office", () => {
    const window = currentTefilaWindow(DEFAULT_PLACE, paris(20, 10)); // 22 h 10
    expect(window).toBeNull();
  });
});

describe("chemins du sidour", () => {
  it("chaque office a sa page de lecture", () => {
    expect(tefilaPath("chaharit")).toBe("/bibliotheque/sidour/chaharit");
    expect(tefilaPath("minha")).toBe("/bibliotheque/sidour/minha");
    expect(tefilaPath("arvit")).toBe("/bibliotheque/sidour/arvit");
  });
});
