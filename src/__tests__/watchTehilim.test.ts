import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildTehilimAsset,
  cleanTehilimLine,
  TEHILIM_CHAPTERS,
} from "../../scripts/lib/watch-tehilim.mjs";
import { cleanText } from "../services/textService";

const raw = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../public/texts/tehilim.json"), "utf8"),
) as Record<string, { he?: string[] }>;

describe("Tehilim embarqués dans les apps de montre", () => {
  it("nettoie exactement comme l'app le fait à l'écran", () => {
    // La montre n'a aucune règle de texte : le nettoyage est fait une fois au
    // setup. Encore faut-il que ce soit le même, sur tout le corpus, sans quoi
    // un verset se lirait autrement au poignet que sur le téléphone.
    const offenders: string[] = [];
    for (let chapter = 1; chapter <= TEHILIM_CHAPTERS; chapter++) {
      for (const line of raw[String(chapter)]?.he ?? []) {
        if (cleanTehilimLine(line) !== cleanText(line)) offenders.push(`Tehilim ${chapter}`);
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });

  it("porte les 150 psaumes, versets nettoyés et non vides", () => {
    const book = buildTehilimAsset(raw) as Record<string, string[]>;
    expect(Object.keys(book)).toHaveLength(TEHILIM_CHAPTERS);
    for (let chapter = 1; chapter <= TEHILIM_CHAPTERS; chapter++) {
      const lines = book[String(chapter)];
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line).not.toMatch(/<[^>]*>/); // plus une balise
        expect(line).not.toMatch(/&(thinsp|nbsp|amp|lt|gt|quot);/); // plus une entité
        expect(line.trim()).toBe(line);
      }
    }
    // Le psaume 117, le plus court du livre, en a deux ; le 119, le plus long,
    // en a beaucoup : de quoi voir qu'on a bien le livre, et pas un gabarit.
    expect(book["117"]).toHaveLength(2);
    expect(book["119"].length).toBeGreaterThan(100);
  });

  it("s'arrête plutôt que d'embarquer un psaume manquant", () => {
    const amputated = { ...raw, "23": { he: [] } };
    expect(() => buildTehilimAsset(amputated)).toThrow(/Tehilim 23/);
  });

  it("tient dans ce qu'une montre peut embarquer", () => {
    // Le fichier part dans l'APK Wear et dans le paquet de l'app watchOS :
    // quelques centaines de kilo-octets, sans commune mesure avec les
    // quarante méga-octets des autres corpus, qui restent sur le téléphone.
    const bytes = Buffer.byteLength(JSON.stringify(buildTehilimAsset(raw)), "utf8");
    expect(bytes).toBeLessThan(1_500_000);
  });
});
