import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  AA_TEXT,
  resolveThemeColors,
  strengthenThemeColors,
  THEME_OPTIONS,
} from "../composables/useTheme";
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
const NUIT_CARTE = "#1f2937";

/**
 * The documented exception (docs/design.md, "Theme colors"): white on the
 * pastel orange of sunset, below the threshold, held instead to the APCA
 * minimum for large headlines. The higher contrast mode brings it to AA.
 */
const ON_BRAND_EXCEPTIONS = new Set(["sunset"]);
/** APCA Lc minimum for large, bold headlines (APCA bronze level). */
const APCA_HEADLINE_MIN = 45;

/** APCA 0.0.98G contrast of a text on a background, as a positive Lc. */
const apca = (text: string, background: string) => {
  const y = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255) ** 2.4);
    const lum = 0.2126729 * r! + 0.7151522 * g! + 0.072175 * b!;
    return lum > 0.022 ? lum : lum + (0.022 - lum) ** 1.414;
  };
  const [t, b] = [y(text), y(background)];
  const s = b > t ? (b ** 0.56 - t ** 0.57) * 1.14 : (b ** 0.65 - t ** 0.62) * 1.14;
  return Math.abs(s) < 0.1 ? 0 : (Math.abs(s) - 0.027) * 100;
};

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
      if (ON_BRAND_EXCEPTIONS.has(theme.id)) continue;
      const { brand, onBrand } = resolveThemeColors(theme);
      expect({ theme: theme.id, lisible: contrast(brand, onBrand) >= ON_BRAND_MIN }).toEqual({
        theme: theme.id,
        lisible: true,
      });
    }
  });

  it("the documented exception still reads on large headlines (APCA)", () => {
    for (const id of ON_BRAND_EXCEPTIONS) {
      const theme = THEME_OPTIONS.find((t) => t.id === id)!;
      const { brand, onBrand } = resolveThemeColors(theme);
      expect({ theme: id, lc: apca(onBrand, brand) >= APCA_HEADLINE_MIN }).toEqual({
        theme: id,
        lc: true,
      });
    }
  });

  it("higher contrast brings every theme to WCAG AA, light and dark", () => {
    for (const theme of [...THEME_OPTIONS, ...HOLIDAY_THEMES]) {
      const resolved = resolveThemeColors(theme);
      const light = strengthenThemeColors(resolved, false);
      const dark = strengthenThemeColors(resolved, true);
      expect({
        theme: theme.id,
        onBrand: contrast(light.brand, light.onBrand) >= AA_TEXT,
        onBrandDark: contrast(dark.brand, dark.onBrand) >= AA_TEXT,
        inks: [light.primary, light.secondary].every(
          (ink) => contrast(ink, FOND) >= AA_TEXT && contrast(ink, SURFACE) >= AA_TEXT,
        ),
        inksDark: [dark.primary, dark.secondary].every(
          (ink) => contrast(ink, NUIT) >= AA_TEXT && contrast(ink, NUIT_CARTE) >= AA_TEXT,
        ),
      }).toEqual({ theme: theme.id, onBrand: true, onBrandDark: true, inks: true, inksDark: true });
    }
  });

  it("higher contrast keeps the orange of sunset, with dark text on it", () => {
    const sunset = strengthenThemeColors(resolveThemeColors(THEME_OPTIONS[0]!), false);
    expect(sunset).toMatchObject({ brand: "#EB9F4F", onBrand: "#3B2412" });
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
      for (const [mode, colors, min] of [
        ["standard", resolveThemeColors(theme), ON_BRAND_MIN],
        ["higher contrast", strengthenThemeColors(resolveThemeColors(theme), false), AA_TEXT],
      ] as const) {
        const { brand, onBrand } = colors;
        const hover = mix(brand);
        const whiteText = luminance(onBrand) > luminance(brand);
        expect({
          theme: theme.id,
          mode,
          fonce: luminance(hover) < luminance(brand),
          lisible: contrast(hover, onBrand) >= (whiteText ? contrast(brand, onBrand) : min),
        }).toEqual({ theme: theme.id, mode, fonce: true, lisible: true });
      }
    }
  });

  it("the pastel orange carries white, orange text takes its ink, the logo's blue stays", () => {
    const [sunset, ocean, emerald] = THEME_OPTIONS.map(resolveThemeColors);
    const orange = {
      secondary: "#D46D01",
      secondaryBrand: "#EB9F4F",
      secondarySoft: "#FFD09E",
    };
    expect(sunset).toMatchObject({
      primary: "#D46D01",
      brand: "#EB9F4F",
      onBrand: "#FFFFFF",
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
    // White is on-brand today, but not in the higher contrast mode (dark text
    // on the orange), and the orange ink does not read on the fill. A class or
    // a rule that puts the fill as background and writes anything other than
    // on-brand on it would only read under some themes or modes.
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
