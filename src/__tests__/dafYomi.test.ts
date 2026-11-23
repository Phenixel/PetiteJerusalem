import { describe, expect, it } from "vitest";
import { DAF_YOMI_CYCLE_DAYS, dafYomiLabel, dafYomiOn, dafYomiRoute } from "../services/dafYomi";

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);
const label = (y: number, m: number, d: number) => {
  const daf = dafYomiOn(at(y, m, d));
  return daf ? dafYomiLabel(daf, "en") : null;
};

describe("dafYomi", () => {
  it("lasts 2,711 days a cycle", () => {
    expect(DAF_YOMI_CYCLE_DAYS).toBe(2711);
  });

  it("follows the fourteenth cycle, from Berakhot 2 to Niddah 73", () => {
    expect(label(2020, 1, 5)).toBe("Berakhot 2");
    expect(dafYomiOn(at(2020, 1, 5))?.cycle).toBe(14);
    expect(label(2020, 3, 7)).toBe("Berakhot 64");
    expect(label(2020, 3, 8)).toBe("Shabbat 2");
    expect(label(2027, 6, 7)).toBe("Niddah 73");
    expect(label(2027, 6, 8)).toBe("Berakhot 2");
    expect(dafYomiOn(at(2027, 6, 8))?.cycle).toBe(15);
  });

  it("matches the end of the thirteenth cycle", () => {
    expect(label(2012, 8, 3)).toBe("Berakhot 2");
    expect(label(2020, 1, 4)).toBe("Niddah 73");
  });

  it("numbers Kinnim, Tamid and Middot as the printed Shas, and reads them from 2a", () => {
    // Find the first day of Tamid in the fourteenth cycle.
    let day = at(2020, 1, 5);
    let found = dafYomiOn(day)!;
    while (found.entry.link.split("/").pop() !== "Tamid") {
      day = new Date(day.getTime() + 86400000);
      found = dafYomiOn(day)!;
    }
    expect(found.daf).toBe(26);
    expect(found.readerDaf).toBe(2);
    expect(dafYomiRoute(found).query?.daf).toBe("2a");
  });

  it("writes the daf in Hebrew letters in Hebrew", () => {
    const daf = dafYomiOn(at(2020, 1, 15))!;
    expect(dafYomiLabel(daf, "he")).toBe("ברכות י״ב");
  });

  it("opens the chapter that holds the daf, and asks the reader to go down to it", () => {
    const daf = dafYomiOn(at(2020, 1, 5))!;
    const route = dafYomiRoute(daf);
    expect(route.query?.daf).toBe("2a");
    expect(route.path).toContain("1");
    // Berakhot 12a sits in the first chapter (2a to 12b).
    const later = dafYomiRoute(dafYomiOn(at(2020, 1, 15))!);
    expect(later.query?.daf).toBe("12a");
    // Berakhot 14a: the second chapter (13a to 17a).
    const second = dafYomiRoute(dafYomiOn(at(2020, 1, 17))!);
    expect(second.query?.daf).toBe("14a");
    expect(second.path).not.toBe(later.path);
  });

  it("opens Shekalim at its chapter list", () => {
    let day = at(2020, 1, 5);
    let found = dafYomiOn(day)!;
    while (found.entry.link.split("/").pop() !== "Shekalim") {
      day = new Date(day.getTime() + 86400000);
      found = dafYomiOn(day)!;
    }
    expect(dafYomiRoute(found).query).toBeUndefined();
  });

  it("knows no daf before the eighth cycle", () => {
    expect(dafYomiOn(at(1970, 1, 1))).toBeNull();
  });
});
