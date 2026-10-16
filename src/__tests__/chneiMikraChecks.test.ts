import { beforeEach, describe, expect, it } from "vitest";
import { takeLegacyChecks } from "../composables/useChneiMikraChecks";

// Les coches de la version 3.10.11, gardées sur l'appareil par semaine
// (« texte:début ») : reprises une fois dans Mon parcours, puis retirées.

const KEY = "pj-chnei-mikra-aliyot";

describe("les montées cochées par la version d'avant", () => {
  beforeEach(() => localStorage.clear());

  it("rend le rang des montées cochées d'un texte, et les retire", () => {
    localStorage.setItem(KEY, JSON.stringify({ "2026-10-17": ["264:0", "264:40", "265:0"] }));
    expect(takeLegacyChecks("2026-10-17", 264, [0, 20, 40])).toEqual([0, 2]);
    expect(JSON.parse(localStorage.getItem(KEY) ?? "{}")).toEqual({ "2026-10-17": ["265:0"] });
    // Une seule fois.
    expect(takeLegacyChecks("2026-10-17", 264, [0, 20, 40])).toEqual([]);
  });

  it("ne touche pas aux autres semaines, et efface le stockage vidé", () => {
    localStorage.setItem(KEY, JSON.stringify({ "2026-10-17": ["264:0"] }));
    expect(takeLegacyChecks("2026-10-24", 264, [0])).toEqual([]);
    expect(takeLegacyChecks("2026-10-17", 264, [0])).toEqual([0]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("un stockage illisible ne rend rien", () => {
    localStorage.setItem(KEY, "{");
    expect(takeLegacyChecks("2026-10-17", 264, [0])).toEqual([]);
  });
});
