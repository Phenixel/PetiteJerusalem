// @vitest-environment node
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import units from "../datas/parcoursUnits.json";

/**
 * `src/datas/parcoursUnits.json` dit ce que compte chaque chapitre des textes
 * qu'on peut se donner à finir (michnayot, côtés de daf, chapitres). Les
 * portions d'un programme se calculent dessus, sans charger les textes.
 *
 * Un texte corrigé (une michna scindée, un chapitre ajouté) sans que ce
 * fichier suive décalerait toutes les portions qui viennent après : « Chabbat
 * 7:1 » ouvrirait la michna d'à côté.
 */

const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(racine, "scripts", "parcours-units.mjs");

describe("unités des programmes", () => {
  it("correspondent aux fichiers de public/texts", () => {
    expect(() => execFileSync(process.execPath, [SCRIPT, "--check"])).not.toThrow();
  });

  it("comptent les textes connus comme on les connaît", () => {
    const table = units as Record<string, { unit: string; sizes?: number[]; count?: number }>;
    // Michna Berakhot (id 41) : neuf chapitres, cinquante-sept michnayot.
    expect(table["41"].unit).toBe("mishna");
    expect(table["41"].sizes?.reduce((a, b) => a + b, 0)).toBe(57);
    // Avot : six chapitres dans le texte, même si le catalogue en annonce cinq.
    const avot = Object.values(table).find(
      (t) => t.unit === "mishna" && t.sizes?.length === 6 && t.sizes[5] === 11,
    );
    expect(avot).toBeDefined();
    // Yeshayahu (id 324) : soixante-six chapitres.
    expect(table["324"]).toEqual({ unit: "chapter", count: 66 });
    // Talmud Berakhot (id 1) : du daf 2a au daf 64a, soit 125 côtés.
    expect(table["1"].unit).toBe("amud");
    expect(table["1"].sizes?.reduce((a, b) => a + b, 0)).toBe(125);
  });
});
