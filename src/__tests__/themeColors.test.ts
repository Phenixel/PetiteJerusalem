import { describe, expect, it } from "vitest";
import { resolveThemeColors, THEME_OPTIONS } from "../composables/useTheme";
import { HOLIDAY_THEMES } from "../services/holidayThemes";

/**
 * Les couleurs de thème (voir docs/design.md, « Les couleurs de thème ») :
 * la teinte de la palette sert de fond plein, l'encre de texte. Chaque rôle
 * doit se lire là où il se pose.
 */
const luminance = (hex: string) => {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const FOND = "#fff9f3";
const SURFACE = "#ffffff";
const NUIT = "#111827";

describe("les couleurs de thème", () => {
  it("l'encre se lit sur le fond clair, sur une carte et sur le fond sombre", () => {
    for (const theme of THEME_OPTIONS) {
      const colors = resolveThemeColors(theme);
      for (const [role, ink] of [
        ["primary", colors.primary],
        ["secondary", colors.secondary],
      ] as const) {
        expect({
          theme: theme.id,
          role,
          fond: contrast(ink, FOND) >= 3.1,
          carte: contrast(ink, SURFACE) >= 3.5,
          nuit: contrast(ink, NUIT) >= 3.3,
        }).toEqual({ theme: theme.id, role, fond: true, carte: true, nuit: true });
      }
    }
  });

  it("ce qui s'écrit sur la teinte s'y lit franchement", () => {
    for (const theme of [...THEME_OPTIONS, ...HOLIDAY_THEMES]) {
      const { brand, onBrand } = resolveThemeColors(theme);
      expect({ theme: theme.id, lisible: contrast(brand, onBrand) >= 3.5 }).toEqual({
        theme: theme.id,
        lisible: true,
      });
    }
  });

  it("les thèmes prennent la palette du logo : orange et bleu, l'un en second de l'autre", () => {
    const [sunset, ocean, emerald] = THEME_OPTIONS.map(resolveThemeColors);
    expect(sunset).toMatchObject({ brand: "#FEA547", secondaryBrand: "#539EE2" });
    expect(ocean).toMatchObject({ brand: "#539EE2", secondaryBrand: "#FEA547" });
    expect(emerald).toMatchObject({ brand: "#059C66", secondaryBrand: "#FEA547" });
  });

  it("un thème de fête, qui ne donne que ses encres, s'en sert aussi de teinte", () => {
    const resolved = resolveThemeColors({ primary: "#9F7A00", secondary: "#FFD23F" });
    expect(resolved.brand).toBe("#9F7A00");
    expect(resolved.onBrand).toBe("#FFFFFF");
    expect(resolved.secondaryBrand).toBe("#FFD23F");
    expect(resolved.brandSoft).toMatch(/^#[0-9a-f]{6}$/);
  });
});
