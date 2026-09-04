import { describe, it, expect } from "vitest";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import {
  encadrementBounds,
  encadrementKeyOf,
  encadrementOf,
  encadrementOfBook,
} from "../services/encadrementService";

/**
 * Les passages qui encadrent une lecture : ce qu'on dit avant les Tehilim et
 * après, avant le Cantique des cantiques et après.
 *
 * Deux choses se vérifient ici plutôt qu'à l'œil. D'abord que les textes
 * arrivent entiers jusqu'au lecteur : ils s'écrivent dans le format des
 * fichiers de tefila, un `he` oublié ou une clé mal nommée donnerait un bloc
 * vide, sans erreur. Ensuite qu'ils ne se répètent pas : une liste de dix
 * Tehilim ne dit pas dix fois le Yehi ratson, qui encadre toute la lecture.
 */

const catalogue = (textStudiesJson as TextStudiesJson).textStudies;
const byId = (id: number): TextStudyJsonEntry => catalogue.find((t) => t.id === id)!;

const TEHILIM_1 = byId(103);
const TEHILIM_2 = byId(104);
const CHIR_HACHIRIM = byId(331);
const BERAKHOT = byId(1);

describe("encadrements des lectures", () => {
  it("reconnaît les lectures qui ont des passages dédiés", () => {
    expect(encadrementKeyOf(TEHILIM_1)).toBe("tehilim");
    expect(encadrementKeyOf(CHIR_HACHIRIM)).toBe("chir-hachirim");
    // Un traité du Talmud, une paracha : rien à dire avant ni après.
    expect(encadrementKeyOf(BERAKHOT)).toBeNull();
    expect(encadrementKeyOf(undefined)).toBeNull();
  });

  it("porte le Yehi ratson des Tehilim, avant et après", () => {
    const passages = encadrementOf(TEHILIM_1)!;
    expect(passages.key).toBe("tehilim");
    // Avant : le Yehi ratson, puis les trois versets de Tehilim 95.
    expect(passages.before).toHaveLength(2);
    expect(passages.before[0].lines[0]).toContain("יְהִי רָצוֹן מִלְּפָנֶיךָ");
    expect(passages.before[1].lines[0]).toContain("לְכוּ נְרַנְּנָה");
    // Après : les trois versets, puis le Yehi ratson en semaine et à Chabbat.
    expect(passages.after).toHaveLength(3);
    expect(passages.after[0].lines[0]).toContain("מִי יִתֵּן מִצִּיּוֹן");
    expect(passages.after[1].labelText?.fr).toContain("semaine");
    expect(passages.after[2].labelText?.fr).toContain("Chabbat");
  });

  it("pose le Yehi ratson au livre des Tehilim, pas sur chacun des psaumes", () => {
    // Le livre : sa page de liste porte les passages, une fois pour les
    // psaumes qu'on va y lire.
    expect(encadrementOfBook("tehilim")?.key).toBe("tehilim");
    expect(encadrementOf(TEHILIM_1)?.place).toBe("book");
    // Les autres livres n'en ont pas, et le Cantique des cantiques porte les
    // siens sur le texte lui-même.
    expect(encadrementOfBook("talmud")).toBeNull();
    expect(encadrementOfBook("tanakh")).toBeNull();
    expect(encadrementOf(CHIR_HACHIRIM)?.place).toBe("text");
  });

  it("porte le Léchem yihoud du Cantique des cantiques, avant et après", () => {
    const passages = encadrementOf(CHIR_HACHIRIM)!;
    expect(passages.before[0].lines[0]).toContain("לְשֵׁם יִחוּד");
    expect(passages.after[0].lines[0]).toContain("רִבּוֹן כָּל הָעוֹלָמִים");
  });

  it("ne laisse aucun bloc sans titre ni sans texte", () => {
    for (const entry of [TEHILIM_1, CHIR_HACHIRIM]) {
      const passages = encadrementOf(entry)!;
      for (const block of [...passages.before, ...passages.after]) {
        expect(block.labelText?.fr).toBeTruthy();
        expect(block.labelText?.en).toBeTruthy();
        expect(block.labelText?.he).toBeTruthy();
        expect(block.paragraphs?.length ?? 0).toBeGreaterThan(0);
        for (const line of block.lines) expect(line.length).toBeGreaterThan(0);
      }
    }
  });

  it("ne dit le Yehi ratson qu'une fois pour une suite de Tehilim", () => {
    const bounds = encadrementBounds([TEHILIM_1, TEHILIM_2, BERAKHOT, CHIR_HACHIRIM]);
    // Le « avant » ouvre le premier psaume, le « après » ferme le dernier.
    expect(bounds.get("103")?.before).toBeDefined();
    expect(bounds.get("103")?.after).toBeUndefined();
    expect(bounds.get("104")?.before).toBeUndefined();
    expect(bounds.get("104")?.after).toBeDefined();
    // Le traité entre les deux n'a rien.
    expect(bounds.has("1")).toBe(false);
    // Seul de son corpus, le Cantique des cantiques porte les deux.
    expect(bounds.get("331")?.before).toBeDefined();
    expect(bounds.get("331")?.after).toBeDefined();
  });

  it("encadre un psaume seul des deux côtés", () => {
    const bounds = encadrementBounds([TEHILIM_1]);
    expect(bounds.get("103")?.before).toBeDefined();
    expect(bounds.get("103")?.after).toBeDefined();
  });
});
