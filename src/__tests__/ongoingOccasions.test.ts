import { describe, expect, it } from "vitest";
import { DEFAULT_PLACE } from "../services/zmanimService";
import { ongoingOccasions } from "../services/ongoingOccasions";

/**
 * « En ce moment » on the home page (services/ongoingOccasions.ts): the
 * moon, the 'Hanouka lighting and the 'Omer, offered for the night under way
 * or, by day, for the night to come, and gone once marked done.
 *
 * In Paris, the moon of Kislev 5787 is blessed from 7 days after its molad
 * (Monday 16 November 2026, 20:06 UTC) until the middle of the lunation
 * (Tuesday 24 November, 14:28 UTC): the nights opening 8 to 14 Kislev, from
 * Tuesday 17 to Monday 23 November in the evening.
 */
const at = (iso: string) => ongoingOccasions(DEFAULT_PLACE, new Date(iso));
const kinds = (iso: string) => at(iso).map((occasion) => occasion.kind);

describe("what is going on now", () => {
  it("offers the moon by day for the night to come, then at night", () => {
    // Monday 23 November 2026, 11 a.m. in Paris: 13 Kislev, tonight is the last night.
    const [day] = at("2026-11-23T10:00:00Z");
    expect(day).toMatchObject({ kind: "halevana", now: false, key: "halevana:5787-9" });
    expect(day.kind === "halevana" && day.until.toString()).toBe("14 Kislev 5787");
    // 7:30 p.m.: night has fallen, it can be said now.
    expect(at("2026-11-23T18:30:00Z")[0]).toMatchObject({ kind: "halevana", now: true });
    // 3 a.m.: still the same night, until dawn.
    expect(at("2026-11-24T02:00:00Z")[0]).toMatchObject({ kind: "halevana", now: true });
  });

  it("drops the moon once its last night is over, and once it is said", () => {
    // Tuesday 24 November 2026, 11 a.m.: the window closed during the night.
    expect(kinds("2026-11-24T10:00:00Z")).toEqual([]);
    const said = ongoingOccasions(DEFAULT_PLACE, new Date("2026-11-23T18:30:00Z"), [
      "halevana:5787-9",
    ]);
    expect(said).toEqual([]);
  });

  it("gives the 'Hanouka candle of tonight, before Shabbat on a Friday", () => {
    // Monday 7 December 2026, by day (27 Kislev 5787): the fourth candle tonight.
    expect(at("2026-12-07T10:00:00Z")).toEqual([
      { kind: "hanouka", key: "hanouka:5787-4", candle: 4, lit: false, beforeShabbat: null },
    ]);
    // Friday 4 December 2026, 1 p.m.: the first candle, lit before Shabbat.
    const [friday] = at("2026-12-04T12:00:00Z");
    expect(friday).toMatchObject({ kind: "hanouka", candle: 1, lit: false });
    expect(friday.kind === "hanouka" && friday.beforeShabbat).toBeInstanceOf(Date);
    // Wednesday 9 December 2026, 8 p.m.: the sixth candle is lit.
    expect(at("2026-12-09T19:00:00Z")[0]).toMatchObject({ kind: "hanouka", candle: 6, lit: true });
  });

  it("gives the day's count of the 'Omer, down to the last", () => {
    // 23 April 2027 by day: 16 Nissan 5787, counted the evening before.
    expect(at("2027-04-23T10:00:00Z")).toEqual([{ kind: "omer", key: "omer:5787-1", day: 1 }]);
    // 5 Sivan: the forty-ninth and last day.
    expect(at("2027-06-10T10:00:00Z")).toEqual([{ kind: "omer", key: "omer:5787-49", day: 49 }]);
  });

  it("shows nothing the rest of the time", () => {
    // Thursday 5 November 2026, 25 Heshvan: no moon, no feast, no 'Omer.
    expect(kinds("2026-11-05T10:00:00Z")).toEqual([]);
  });
});
