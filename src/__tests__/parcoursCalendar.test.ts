import { describe, expect, it } from "vitest";
import { milestoneEve, restCalendar } from "../services/parcours/calendar";
import { dayKeyAt, dayStartOf, nextDayStart } from "../services/parcours/dayStart";
import { deckOrder, momentAt } from "../services/parcours/moments";
import {
  computeZmanim,
  DEFAULT_PLACE,
  type ZmanKey,
  type ZmanimPlace,
} from "../services/zmanimService";

/**
 * Le calendrier de Mon parcours (services/parcours/calendar.ts) : les jours
 * de repos, qui ne coupent pas la série et ne donnent pas de portion au
 * rythme « sauf Chabbat », et les dates qu'on se donne pour finir. Et les
 * moments de la journée (services/parcours/moments.ts), qui ordonnent le
 * paquet de l'accueil.
 */

describe("les jours de repos", () => {
  const diaspora = restCalendar(false);
  const israel = restCalendar(true);

  it("comptent Chabbat et les fêtes chômées, et pas Hol hamoed", () => {
    expect(diaspora("2026-09-21")).toBe(true); // Kippour, un lundi
    expect(diaspora("2026-09-29")).toBe(false); // Hol hamoed Souccot
    expect(diaspora("2026-10-10")).toBe(true); // un Chabbat ordinaire
    expect(diaspora("2026-10-14")).toBe(false);
  });

  it("donnent le second jour de fête hors d'Israël seulement", () => {
    expect(diaspora("2026-09-27")).toBe(true);
    expect(israel("2026-09-27")).toBe(false);
  });
});

describe("les dates qu'on se donne", () => {
  it("finissent la veille de la fête qui vient", () => {
    expect(milestoneEve("roshHashana", "2026-10-14")).toBe("2027-10-01");
    expect(milestoneEve("pessah", "2026-10-14")).toBe("2027-04-21");
  });
});

/** A time of a civil day at a place, as the times page shows it. */
function zman(place: ZmanimPlace, day: Date, key: ZmanKey): Date | undefined {
  return computeZmanim(place, day).find((z) => z.key === key)?.date;
}

const LONDON: ZmanimPlace = {
  source: "city",
  latitude: 51.5074,
  longitude: -0.1278,
  tzid: "Europe/London",
  city: "Londres",
};
const TROMSO: ZmanimPlace = {
  source: "city",
  latitude: 69.6492,
  longitude: 18.9553,
  tzid: "Europe/Oslo",
  city: "Tromsø",
};

describe("the journey's day (parcours/dayStart.ts)", () => {
  const minute = 60_000;

  it("keeps the night with the evening before, until dawn at the place", () => {
    // Arvit or the bedtime Chema checked at 1 a.m. count for the evening's day.
    const dawn = zman(DEFAULT_PLACE, new Date(2026, 9, 15, 12), "alotHaShachar")!;
    expect(dayStartOf(DEFAULT_PLACE, "2026-10-15")).toEqual(dawn);
    expect(dayKeyAt(new Date(2026, 9, 14, 23, 30), DEFAULT_PLACE)).toBe("2026-10-14");
    expect(dayKeyAt(new Date(2026, 9, 15, 1), DEFAULT_PLACE)).toBe("2026-10-14");
    expect(dayKeyAt(new Date(dawn.getTime() - minute), DEFAULT_PLACE)).toBe("2026-10-14");
    expect(dayKeyAt(dawn, DEFAULT_PLACE)).toBe("2026-10-15");
    expect(dayKeyAt(new Date(2026, 9, 1, 0, 30), DEFAULT_PLACE)).toBe("2026-09-30");
  });

  it("follows the seasons: no fixed hour", () => {
    // In Paris, dawn comes before 3 a.m. at the end of June, near 7 a.m. in December.
    const june = zman(DEFAULT_PLACE, new Date(2026, 5, 21, 12), "alotHaShachar")!;
    const december = zman(DEFAULT_PLACE, new Date(2026, 11, 15, 12), "alotHaShachar")!;
    const timeOfDay = (date: Date) =>
      date.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    expect(timeOfDay(december) - timeOfDay(june)).toBeGreaterThan(3 * 3600_000);
    expect(dayKeyAt(new Date(june.getTime() + minute), DEFAULT_PLACE)).toBe("2026-06-21");
    expect(dayKeyAt(new Date(december.getTime() - minute), DEFAULT_PLACE)).toBe("2026-12-14");
  });

  it("takes misheyakir, then sunrise, where the opinion has no dawn, and midnight without a sunrise", () => {
    // London, end of June: never 16.1° below the horizon (Rav Posen's dawn).
    const day = new Date(2026, 5, 21, 12);
    expect(zman(LONDON, day, "alotHaShachar")).toBeUndefined();
    expect(dayStartOf(LONDON, "2026-06-21")).toEqual(zman(LONDON, day, "misheyakir"));
    // Tromsø, under the midnight sun: the day turns at midnight.
    expect(zman(TROMSO, day, "sunrise")).toBeUndefined();
    expect(dayStartOf(TROMSO, "2026-06-21")).toEqual(new Date(2026, 5, 21));
  });

  it("gives the next dawn as the end of the day's checks", () => {
    const dawn = zman(DEFAULT_PLACE, new Date(2026, 9, 15, 12), "alotHaShachar");
    expect(nextDayStart(new Date(2026, 9, 14, 23, 30), DEFAULT_PLACE)).toEqual(dawn);
    expect(nextDayStart(new Date(2026, 9, 15, 1), DEFAULT_PLACE)).toEqual(dawn);
    expect(nextDayStart(new Date(2026, 9, 15, 12), DEFAULT_PLACE)).toEqual(
      zman(DEFAULT_PLACE, new Date(2026, 9, 16, 12), "alotHaShachar"),
    );
  });
});

describe("les moments de la journée", () => {
  const times = {
    dayStart: new Date(2026, 9, 14, 6, 37),
    chatzot: new Date(2026, 9, 14, 13, 30),
    sunset: new Date(2026, 9, 14, 19, 5),
  };

  it("suivent le soleil, et le coucher de 22 h à l'aube", () => {
    expect(momentAt(new Date(2026, 9, 14, 9), times)).toBe("morning");
    expect(momentAt(new Date(2026, 9, 14, 17), times)).toBe("afternoon");
    expect(momentAt(new Date(2026, 9, 14, 19, 30), times)).toBe("evening");
    expect(momentAt(new Date(2026, 9, 14, 23), times)).toBe("bedtime");
    expect(momentAt(new Date(2026, 9, 14, 1), times)).toBe("bedtime");
    expect(momentAt(new Date(2026, 9, 14, 6, 30), times)).toBe("bedtime");
    expect(momentAt(new Date(2026, 9, 14, 6, 40), times)).toBe("morning");
  });

  it("ouvrent le paquet sur le moment présent, puis ce qui vient, enfin ce qui est passé", () => {
    const order = (["morning", "afternoon", "evening", "bedtime", "anytime"] as const)
      .slice()
      .sort((a, b) => deckOrder(a, "afternoon") - deckOrder(b, "afternoon"));
    expect(order).toEqual(["afternoon", "anytime", "evening", "bedtime", "morning"]);
  });
});
