import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCardSvg, smallCaps, wrapText } from "../../functions/src/ogCardSvg";

/**
 * The per-session share card: the designer's banner without its tagline, the
 * session name written in its place. The render itself needs the native resvg
 * binary of the functions; what is checked here is the layout it is given.
 */

const FUNCTIONS = join(__dirname, "../../functions");
const BACKGROUND = "data:image/png;base64,AAAA";

const card = (title: string) =>
  buildCardSvg(
    { title, label: "Chaîne de Tehilim", callToAction: "Rejoignez la chaîne." },
    BACKGROUND,
  );

/** The text of the black lines (the session name), in order. */
const nameLines = (svg: string): string[] =>
  [...svg.matchAll(/fill="#000000"[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

describe("session share card", () => {
  it("draws over the designer's banner, bundled with the function", () => {
    const svg = card("Refoua chelema de David ben Sarah");
    expect(svg).toContain(`href="${BACKGROUND}"`);
    const png = readFileSync(join(FUNCTIONS, "assets/session-card.png"));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });

  it("bundles every font the card names", () => {
    for (const file of [
      "PlayfairDisplay-Regular.ttf",
      "Manrope-Medium.ttf",
      "NotoSansHebrew-Bold.ttf",
    ]) {
      expect([file, existsSync(join(FUNCTIONS, "fonts", file))]).toEqual([file, true]);
    }
  });

  it("writes the name, then the call to join in blue", () => {
    const svg = card("Refoua chelema de David ben Sarah");
    expect(nameLines(svg).join(" ")).toBe("Refoua chelema de David ben Sarah");
    expect(svg).toMatch(/fill="#539EE2"[^>]*>Rejoignez la chaîne\.<\/text>/);
  });

  it("keeps a long name on three smaller lines at most, cut with an ellipsis", () => {
    const svg = card(
      "Leilouy nichmat de notre grand-père bien-aimé Yossef ben Rahel et de toute sa famille, et de tous les disparus de la communauté",
    );
    const lines = nameLines(svg);
    expect(lines.length).toBe(3);
    expect(lines[2].endsWith("…")).toBe(true);
    expect(svg).toContain('font-size="34"');
  });

  it("sets a Hebrew name right to left", () => {
    expect(card("לרפואת שלמה בן רחל")).toMatch(/direction="rtl"[^>]*>לרפואת שלמה בן רחל</);
    expect(card("Refoua chelema")).not.toContain('direction="rtl"');
  });

  it("escapes what the session creator typed", () => {
    const svg = card(`<script>&"`);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;&amp;&quot;");
  });

  it("sets the label in small capitals, proper nouns keeping their capital", () => {
    expect(smallCaps("Chaîne de Tehilim", 44)).toBe(
      '<tspan font-size="44">C</tspan>' +
        '<tspan font-size="33" letter-spacing="1">HAÎNE DE </tspan>' +
        '<tspan font-size="44">T</tspan>' +
        '<tspan font-size="33" letter-spacing="1">EHILIM</tspan>',
    );
  });

  it("wraps on words", () => {
    expect(wrapText("un deux trois quatre", 10, 3)).toEqual(["un deux", "trois", "quatre"]);
  });
});
