import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { resolveThemeColors, THEME_OPTIONS } from "../composables/useTheme";
import { HOLIDAY_THEMES } from "../services/holidayThemes";

/**
 * Les couleurs de thème (voir docs/design.md, « Les couleurs de thème ») :
 * dans chaque famille, une encre pour le texte et une teinte pour les fonds
 * pleins, avec ce qui s'écrit dessus. Chaque rôle doit se lire là où il se
 * pose.
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
/** Le seuil de ce qui s'écrit sur la teinte, au repos comme au survol. */
const ON_BRAND_MIN = 3.5;
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
      expect({ theme: theme.id, lisible: contrast(brand, onBrand) >= ON_BRAND_MIN }).toEqual({
        theme: theme.id,
        lisible: true,
      });
    }
  });

  it("au survol, le bouton plein se fonce, et son texte s'y lit toujours franchement", () => {
    // La règle de main.css, relue telle quelle : la teinte mêlée d'une autre
    // couleur, dans l'espace sRGB. Le blanc s'y lit mieux qu'au repos ; le
    // brun d'une teinte claire un peu moins, mais au même seuil que la teinte.
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
      const hover = mix(brand);
      const whiteText = luminance(onBrand) > luminance(brand);
      expect({
        theme: theme.id,
        fonce: luminance(hover) < luminance(brand),
        lisible: contrast(hover, onBrand) >= (whiteText ? contrast(brand, onBrand) : ON_BRAND_MIN),
      }).toEqual({ theme: theme.id, fonce: true, lisible: true });
    }
  });

  it("l'orange clair porte le brun, le texte orange prend son encre, le bleu du logo reste", () => {
    const [sunset, ocean, emerald] = THEME_OPTIONS.map(resolveThemeColors);
    const orange = {
      secondary: "#D46D01",
      secondaryBrand: "#FEA547",
      secondarySoft: "#FFD09E",
    };
    expect(sunset).toMatchObject({
      primary: "#D46D01",
      brand: "#FEA547",
      onBrand: "#3B2412",
      brandSoft: "#FFD09E",
      secondary: "#328CDC",
      secondarySoft: "#A9CCEB",
    });
    expect(ocean).toMatchObject({
      primary: "#328CDC",
      brand: "#328CDC",
      onBrand: "#FFFFFF",
      ...orange,
    });
    expect(emerald).toMatchObject({
      primary: "#059C66",
      brand: "#059C66",
      onBrand: "#FFFFFF",
      ...orange,
    });
  });

  it("sur la teinte, on écrit on-brand : ni le blanc, ni l'encre", () => {
    // Le blanc ne se lit pas sur l'orange clair (2:1), l'encre orange non plus
    // (1,8:1). Une classe ou une règle qui pose la teinte en fond et écrit
    // dessus autre chose que on-brand ne se lirait que sous certains thèmes.
    const files = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === "__tests__" ? [] : files(path);
        return /\.(vue|css|ts)$/.test(name) ? [path] : [];
      });
    const offenders: string[] = [];
    for (const file of files("src")) {
      const source = readFileSync(file, "utf8");
      // Une liste de classes, entre guillemets ou apostrophes.
      for (const [list] of source.matchAll(/["'`][^"'`\n]*\bbg-brand(?![\w/-])[^"'`\n]*["'`]/g)) {
        if (/\btext-(white|primary)(?![\w-])/.test(list)) offenders.push(`${file} : ${list}`);
      }
      // Une règle CSS qui pose la teinte en fond.
      for (const [block] of source.matchAll(
        /\{[^{}]*background(-color)?:\s*var\(--color-brand\)[^{}]*\}/g,
      )) {
        if (/(^|[\s;{])color:\s*(#fff\b|#ffffff\b|white\b|var\(--color-primary\))/i.test(block)) {
          offenders.push(`${file} : ${block.replace(/\s+/g, " ").slice(0, 90)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("un thème de fête, qui ne donne que ses encres, s'en sert aussi de teinte", () => {
    const resolved = resolveThemeColors({ primary: "#9F7A00", secondary: "#FFD23F" });
    expect(resolved.brand).toBe("#9F7A00");
    expect(resolved.onBrand).toBe("#FFFFFF");
    expect(resolved.secondaryBrand).toBe("#FFD23F");
    expect(resolved.brandSoft).toMatch(/^#[0-9a-f]{6}$/);
  });
});
