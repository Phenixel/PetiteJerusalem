import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { QATAN_COLOR_FAMILIES } from "../composables/useFonts";
import { qatanPaletteRule } from "../composables/useTheme";

const css = readFileSync(join(import.meta.dirname, "../assets/main.css"), "utf8");

/** The CSS families served from the fonts built by scripts/hebrew-fonts.py. */
const builtFamilies = new Set(
  [...css.matchAll(/@font-face\s*\{[^}]*\}/g)]
    .map((match) => match[0])
    .filter((face) =>
      /\/fonts\/(frank-ruhl-libre-hebrew|david-libre-hebrew|heebo-hebrew|taamey-frank-pj)/.test(
        face,
      ),
    )
    .map((face) => /font-family:\s*"([^"]+)"/.exec(face)![1]),
);

describe("the qamats qatan in the theme color", () => {
  it("names in the palette every family whose qatan is a color glyph", () => {
    // A family missing from the list keeps the default ink under every theme.
    expect([...builtFamilies].sort()).toEqual([...QATAN_COLOR_FAMILIES].sort());
  });

  it("puts the palette on the root, and writes the rule with the color itself", () => {
    expect(css).toMatch(/:root\s*\{\s*font-palette:\s*--pj-qatan;/);
    const rule = qatanPaletteRule("#0f766e");
    expect(rule).toMatch(/^@font-palette-values --pj-qatan \{/);
    expect(rule).toContain("override-colors: 0 #0f766e;");
    for (const family of QATAN_COLOR_FAMILIES) expect(rule).toContain(`"${family}"`);
  });
});
