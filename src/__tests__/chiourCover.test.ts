import { describe, expect, it } from "vitest";
import { COVER_INK, COVER_TONES, coverInitials, coverTone } from "../components/chiourim/cover";
import { formatMinutes, totalDuration } from "../components/chiourim/duration";

/**
 * Les pochettes des cours (ChiourCover) : une teinte stable par série, le
 * titre crème lisible sur chacune, des initiales qui disent la série.
 */

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("pochettes des cours", () => {
  it("portent le titre crème à 4,5:1 au moins", () => {
    for (const tone of COVER_TONES) expect(contrast(COVER_INK, tone)).toBeGreaterThanOrEqual(4.5);
  });

  it("gardent la même teinte d'une visite à l'autre", () => {
    expect(coverTone("Michel-Cohen--Pélé-Yoets")).toBe(coverTone("Michel-Cohen--Pélé-Yoets"));
    expect(COVER_TONES).toContain(coverTone("n'importe quoi"));
  });

  it("tirent leurs initiales des mots qui comptent", () => {
    expect(coverInitials("Pélé Yoets")).toBe("PY");
    expect(coverInitials("Rav Gad GuiGui")).toBe("GG");
    expect(coverInitials("Sifté Haïm - Biour Tfila")).toBe("SH");
    expect(coverInitials("Tsadik vé ra lo, Racha vé tov lo")).toBe("TV");
    expect(coverInitials("שער הבטחון")).toBe("שה");
    expect(coverInitials("3 hadassim")).toBe("H");
  });
});

describe("durée d'un cours", () => {
  it("se dit en minutes, puis en heures, avec des espaces insécables", () => {
    expect(formatMinutes(0)).toBe("");
    expect(formatMinutes(20)).toBe("1 min");
    expect(formatMinutes(35 * 60)).toBe("35 min");
    expect(formatMinutes(65 * 60)).toBe("1 h 05");
    expect(formatMinutes(120 * 60)).toBe("2 h");
    expect(formatMinutes(35 * 60, "he")).toBe("35 דק׳");
  });

  it("additionne les durées connues", () => {
    expect(totalDuration([{ duration: 60 }, { duration: null }, { duration: 30 }])).toBe(90);
  });
});
