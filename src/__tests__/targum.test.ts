import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseContent } from "../services/textService";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson } from "../models/models";

describe("targum des parachiot", () => {
  it("attache le targoum aligné à la section d'une paracha", () => {
    const entry = (textStudiesJson as TextStudiesJson).textStudies.find((t) => t.id === 309)!;
    const data = JSON.parse(
      readFileSync(resolve(__dirname, "../../public/texts/tanakh/309.json"), "utf8"),
    );
    const content = parseContent(entry, data);
    const section = content.sections[0];
    expect(section.targum).toBeDefined();
    expect(section.targum!.length).toBe(section.he.length);
    expect(section.targum![0].length).toBeGreaterThan(0);
    expect(section.targum![17].length).toBeGreaterThan(0);
  });
});
