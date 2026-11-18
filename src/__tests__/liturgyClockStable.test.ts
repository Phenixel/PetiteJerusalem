// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The reader's clock (useNow) ticks every thirty seconds. The occasions of
 * an office (TextReadingPage, `calendarOccasions`) used to read it directly:
 * every tick gave a new set of occasions, hence new visible blocks, and the
 * whole office (Cha'harit: about 4,400 nodes, retransliterated in phonetic
 * mode) was rebuilt twice a minute while one prays, about 126 ms each time.
 *
 * The clock now reaches them only through boolean computeds (sans tahanoun
 * now, past hatsot now): a computed whose value does not change does not
 * wake its dependents. This test keeps `now.value` out of the occasions.
 */
const source = readFileSync("src/views/TextReading/TextReadingPage.vue", "utf8");

function computedBody(name: string): string {
  const start = source.indexOf(`const ${name} = computed(`);
  expect(start, `${name} not found`).toBeGreaterThan(-1);
  const end = source.indexOf("\n});", start);
  return source.slice(start, end);
}

describe("the occasions of an office", () => {
  it("do not read the clock directly", () => {
    expect(computedBody("calendarOccasions")).not.toContain("now.value");
  });

  it("read it through booleans that only change at the moment it matters", () => {
    expect(source).toMatch(/const sansTahanounNow = computed\(\s*\(\) =>/);
    expect(source).toMatch(/const pastChatzotNow = computed\(/);
  });
});
