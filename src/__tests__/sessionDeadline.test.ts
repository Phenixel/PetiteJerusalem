import { describe, expect, it } from "vitest";
import { deadlineDays, isShortDeadline, SHORT_DEADLINE_DAYS } from "../services/sessionDeadline";

/**
 * Une chaîne dont la date limite tombe ce soir ou demain soir demande une
 * confirmation à sa création (docs/design.md, « Une chaîne courte se
 * confirme ») ; au-delà, rien ne s'interpose.
 */

// Le 1er octobre 2026 à 10 h, heure de l'appareil.
const NOW = new Date(2026, 9, 1, 10, 0, 0).getTime();

describe("la date limite d'une chaîne", () => {
  it("compte les jours comme `deadline_days` : 1 ce soir, 2 demain soir", () => {
    expect(deadlineDays("2026-10-01", NOW)).toBe(1);
    expect(deadlineDays("2026-10-02", NOW)).toBe(2);
    expect(deadlineDays("2026-10-08", NOW)).toBe(8);
  });

  it("est courte ce soir et demain soir, plus après", () => {
    expect(SHORT_DEADLINE_DAYS).toBe(2);
    expect(isShortDeadline("2026-10-01", NOW)).toBe(true);
    expect(isShortDeadline("2026-10-02", NOW)).toBe(true);
    expect(isShortDeadline("2026-10-03", NOW)).toBe(false);
  });

  it("ne dit rien tant que la date n'est pas choisie", () => {
    expect(isShortDeadline("", NOW)).toBe(false);
  });
});
