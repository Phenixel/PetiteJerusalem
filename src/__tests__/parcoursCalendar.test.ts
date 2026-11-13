import { describe, expect, it } from "vitest";
import { milestoneEve, restCalendar } from "../services/parcours/calendar";
import { deckOrder, momentAt } from "../services/parcours/moments";

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

describe("les moments de la journée", () => {
  const times = {
    chatzot: new Date(2026, 9, 14, 13, 30),
    sunset: new Date(2026, 9, 14, 19, 5),
  };

  it("suivent le soleil, et le coucher à partir de 22 h", () => {
    expect(momentAt(new Date(2026, 9, 14, 9), times)).toBe("morning");
    expect(momentAt(new Date(2026, 9, 14, 17), times)).toBe("afternoon");
    expect(momentAt(new Date(2026, 9, 14, 19, 30), times)).toBe("evening");
    expect(momentAt(new Date(2026, 9, 14, 23), times)).toBe("bedtime");
    expect(momentAt(new Date(2026, 9, 15, 1), times)).toBe("bedtime");
  });

  it("gardent le coucher jusqu'à l'aube, quand on la connaît", () => {
    const dawn = { ...times, dawn: new Date(2026, 9, 14, 6, 40) };
    expect(momentAt(new Date(2026, 9, 14, 5), dawn)).toBe("bedtime");
    expect(momentAt(new Date(2026, 9, 14, 6, 40), dawn)).toBe("morning");
  });

  it("ouvrent le paquet sur le moment présent, puis ce qui vient, enfin ce qui est passé", () => {
    const order = (["morning", "afternoon", "evening", "bedtime", "anytime"] as const)
      .slice()
      .sort((a, b) => deckOrder(a, "afternoon") - deckOrder(b, "afternoon"));
    expect(order).toEqual(["afternoon", "anytime", "evening", "bedtime", "morning"]);
  });
});
