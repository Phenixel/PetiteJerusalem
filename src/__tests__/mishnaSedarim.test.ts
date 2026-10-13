import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import textStudiesJson from "../datas/textStudies.json";
import type { Session, TextStudiesJson } from "../models/models";
import { EnumTypeTextStudy } from "../models/typeTextStudy";
import { latinPart } from "../services/catalogSearch";
import { resolveFilePath } from "../services/textService";

/**
 * La Michna du catalogue est entière : ses six sedarim, leurs soixante-trois
 * traités, dans l'ordre où ils se lisent. Edouyot y manquait, et le compte de
 * Nezikin (611 michnayot au lieu de 685) comme celui de tout le Chass (4 118
 * au lieu de 4 192) auraient été faux pour qui découpe un seder en portions.
 */

vi.mock("../services/firestoreService");
vi.mock("../firebase/firestore", () => ({ db: {} }));

const NEZIKIN = "נזיקין (Nezikin)";
const mishna = (textStudiesJson as TextStudiesJson).textStudies.filter(
  (entry) => String(entry.type) === "Mishna",
);
const perakim = (entry: (typeof mishna)[number]): string[][] =>
  JSON.parse(readFileSync(`public${resolveFilePath(entry)}`, "utf8")).he;
const michnayot = (entries: typeof mishna): number =>
  entries.reduce((sum, entry) => sum + perakim(entry).flat().length, 0);

describe("les sedarim de la Michna", () => {
  it("comptent leurs traités, dans l'ordre des sedarim", () => {
    const counts = new Map<string, number>();
    for (const entry of mishna) {
      const seder = latinPart(entry.livre);
      counts.set(seder, (counts.get(seder) ?? 0) + 1);
    }
    expect([...counts]).toEqual([
      ["Zeraim", 11],
      ["Moed", 12],
      ["Nashim", 7],
      ["Nezikin", 10],
      ["Kodashim", 11],
      ["Toharot", 12],
    ]);
  });

  it("servent un fichier pour chaque traité", () => {
    const missing = mishna
      .filter((entry) => !existsSync(`public${resolveFilePath(entry)}`))
      .map((entry) => latinPart(entry.name));
    expect(missing).toEqual([]);
  });

  it("rangent Edouyot à sa place dans Nezikin, entre Shevuot et Avodah Zarah", () => {
    const nezikin = mishna.filter((entry) => entry.livre === NEZIKIN);
    expect(nezikin.map((entry) => latinPart(entry.name))).toEqual([
      "Bava Kamma",
      "Bava Metzia",
      "Bava Batra",
      "Sanhedrin",
      "Makkot",
      "Shevuot",
      "Eduyot",
      "Avodah Zarah",
      "Avot",
      "Horayot",
    ]);
  });

  it("gardent cet ordre dans une chaîne de partage, quel que soit l'identifiant", async () => {
    // Edouyot porte un identifiant plus grand que ses voisins : la chaîne se
    // range sur le catalogue, pas sur les identifiants.
    const { sessionService } = await import("../services/sessionService");
    const session = { id: "s1", type: EnumTypeTextStudy.Mishna, reservations: [] };
    const texts = sessionService.getSessionTextStudies(session as unknown as Session);
    const grouped = sessionService.groupTextStudiesByBook(texts);
    expect(grouped[NEZIKIN].map((text) => latinPart(text.name))).toEqual(
      mishna.filter((entry) => entry.livre === NEZIKIN).map((entry) => latinPart(entry.name)),
    );
  });

  it("donnent à Edouyot ses huit perakim et ses 74 michnayot, vocalisées", () => {
    const eduyot = mishna.find((entry) => latinPart(entry.name) === "Eduyot")!;
    const chapters = perakim(eduyot);
    expect(eduyot.totalSections).toBe(8);
    expect(chapters.map((perek) => perek.length)).toEqual([14, 10, 12, 12, 7, 3, 9, 7]);
    expect(chapters.flat().filter((michna) => !/[ְ-ּ]/.test(michna))).toEqual([]);
  });

  it("font le compte de Nezikin et de toute la Michna", () => {
    // Compté sur les fichiers, donc avec les deux baraïtot que le catalogue
    // ne donne pas à partager (Avot 6, 11 michnayot ; Bikkurim 4, 5 michnayot ;
    // voir catalogSections.test.ts) : 674 et 4 176 sans elles.
    expect(michnayot(mishna.filter((entry) => entry.livre === NEZIKIN))).toBe(685);
    expect(michnayot(mishna)).toBe(4192);
  });
});
