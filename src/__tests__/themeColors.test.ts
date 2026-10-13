import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveThemeColors, THEME_OPTIONS } from "../composables/useTheme";
import { HOLIDAY_THEMES } from "../services/holidayThemes";

/**
 * Les couleurs de thème (voir docs/design.md, « Les couleurs de thème ») :
 * une couleur par famille, qui sert de fond plein sous du blanc et d'encre
 * sur le fond. Chaque rôle doit se lire là où il se pose.
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

  it("au survol, le bouton plein se fonce : son texte s'y lit au moins aussi bien", () => {
    // La règle de main.css, relue telle quelle : la teinte mêlée d'une autre
    // couleur, dans l'espace sRGB.
    const css = readFileSync("src/assets/main.css", "utf8");
    const rule = css.match(
      /\.btn-primary:hover:not\(:disabled\)\s*\{\s*background-color:\s*color-mix\(in srgb, var\(--color-brand\) (\d+)%, (#[0-9a-f]{6})\)/i,
    );
    expect(rule).not.toBeNull();
    const [, share, other] = rule!;
    const mix = (hex: string) => {
      const p = Number(share) / 100;
      const channel = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
      return `#${[1, 3, 5]
        .map((i) => Math.round(channel(hex, i) * p + channel(other, i) * (1 - p)))
        .map((c) => c.toString(16).padStart(2, "0"))
        .join("")}`;
    };
    for (const theme of [...THEME_OPTIONS, ...HOLIDAY_THEMES]) {
      const { brand, onBrand } = resolveThemeColors(theme);
      const hover = contrast(mix(brand), onBrand);
      expect({ theme: theme.id, lisible: hover >= contrast(brand, onBrand) }).toEqual({
        theme: theme.id,
        lisible: true,
      });
    }
  });

  it("les thèmes prennent le vermillon d'origine et le bleu du logo, du blanc dessus", () => {
    const [sunset, ocean, emerald] = THEME_OPTIONS.map(resolveThemeColors);
    expect(sunset).toMatchObject({
      primary: "#DE4F17",
      brand: "#DE4F17",
      onBrand: "#FFFFFF",
      secondary: "#328CDC",
    });
    expect(ocean).toMatchObject({ primary: "#328CDC", brand: "#328CDC", secondary: "#DE4F17" });
    expect(emerald).toMatchObject({ primary: "#059C66", brand: "#059C66", secondary: "#DE4F17" });
  });

  it("un thème de fête, qui ne donne que ses encres, s'en sert aussi de teinte", () => {
    const resolved = resolveThemeColors({ primary: "#9F7A00", secondary: "#FFD23F" });
    expect(resolved.brand).toBe("#9F7A00");
    expect(resolved.onBrand).toBe("#FFFFFF");
    expect(resolved.secondaryBrand).toBe("#FFD23F");
    expect(resolved.brandSoft).toMatch(/^#[0-9a-f]{6}$/);
  });
});
