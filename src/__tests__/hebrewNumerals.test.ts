import { describe, it, expect } from "vitest";
import {
  toHebrewNumeral,
  formatNumberWithHebrew,
  appendHebrewNumeral,
} from "../services/hebrewNumerals";

describe("toHebrewNumeral", () => {
  it("convertit les unités (lettre seule, sans marque)", () => {
    expect(toHebrewNumeral(1)).toBe("א");
    expect(toHebrewNumeral(5)).toBe("ה");
    expect(toHebrewNumeral(9)).toBe("ט");
  });

  it("convertit les dizaines et centaines seules", () => {
    expect(toHebrewNumeral(10)).toBe("י");
    expect(toHebrewNumeral(100)).toBe("ק");
  });

  it("insère un guershayim avant la dernière lettre des nombres composés", () => {
    expect(toHebrewNumeral(11)).toBe("י״א");
    expect(toHebrewNumeral(21)).toBe("כ״א");
    expect(toHebrewNumeral(150)).toBe("ק״נ");
  });

  it("écrit 15 et 16 en ט״ו / ט״ז pour éviter le nom divin", () => {
    expect(toHebrewNumeral(15)).toBe("ט״ו");
    expect(toHebrewNumeral(16)).toBe("ט״ז");
    expect(toHebrewNumeral(115)).toBe("קט״ו");
  });

  it("gère les Tehilim jusqu'à 150", () => {
    expect(toHebrewNumeral(119)).toBe("קי״ט");
    // Pas de forme finale (sofit) : 120 → ק״כ, jamais ק״ך.
    expect(toHebrewNumeral(120)).toBe("ק״כ");
  });

  it("laisse passer les valeurs non entières ou non positives", () => {
    expect(toHebrewNumeral(0)).toBe("0");
    expect(toHebrewNumeral(-3)).toBe("-3");
    expect(toHebrewNumeral(1.5)).toBe("1.5");
  });
});

describe("formatNumberWithHebrew", () => {
  it("affiche le chiffre puis la lettre entre parenthèses", () => {
    expect(formatNumberWithHebrew(5)).toBe("5 (ה)");
    expect(formatNumberWithHebrew(119)).toBe("119 (קי״ט)");
  });
});

describe("appendHebrewNumeral", () => {
  it("ajoute la guématria à un nom se terminant par un nombre", () => {
    expect(appendHebrewNumeral("Tehilim 5")).toBe("Tehilim 5 (ה)");
    expect(appendHebrewNumeral("Tehilim 150")).toBe("Tehilim 150 (ק״נ)");
  });

  it("laisse les noms sans nombre final inchangés", () => {
    expect(appendHebrewNumeral("ברכות (Berakhot)")).toBe("ברכות (Berakhot)");
    expect(appendHebrewNumeral("Mishna Berachot")).toBe("Mishna Berachot");
  });
});
