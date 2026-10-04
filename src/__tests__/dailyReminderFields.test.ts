import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Le rappel quotidien (functions/src/dailyReminder.ts) relit toutes les cinq
 * minutes le profil de chaque abonné : il n'en demande que les champs dont il
 * a besoin (REMINDER_FIELDS), et non le document entier avec ses marque-pages
 * et positions de lecture.
 *
 * Le revers d'une projection : un champ lu sans y figurer vaut `undefined`,
 * sans erreur, et le rappel se tait ou part à la mauvaise heure. Ce test
 * relie les deux listes : tout `prefs.<champ>` lu est demandé.
 */

const source = readFileSync(resolve(__dirname, "../../functions/src/dailyReminder.ts"), "utf8");

function projectedFields(): string[] {
  const block = /const REMINDER_FIELDS = \[([^\]]*)\]/.exec(source);
  if (!block) return [];
  return [...block[1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
}

describe("champs du profil lus par le rappel quotidien", () => {
  it("ne demande que des champs projetés", () => {
    expect(source).toContain(".select(...REMINDER_FIELDS)");
  });

  it("projette tout champ que le rappel lit", () => {
    const read = new Set([...source.matchAll(/\bprefs\.(\w+)/g)].map((m) => m[1]));
    expect(read.size).toBeGreaterThan(0);
    expect([...read].filter((field) => !projectedFields().includes(field))).toEqual([]);
  });
});
