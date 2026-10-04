import { afterEach, describe, expect, it } from "vitest";
import {
  placeDayAfter,
  placeDayKey,
  placeDayOffset,
  type ZmanimPlace,
} from "../services/zmanimService";
import { planZmanReminders } from "../services/zmanReminderService";

/**
 * Les jours de la page des horaires, du widget et des rappels se comptent dans
 * le calendrier du LIEU, quel que soit le fuseau de l'appareil.
 *
 * Deux défauts :
 * - avancer « d'un jour » gardait l'heure murale de l'appareil ; la semaine où
 *   l'appareil et le lieu ne changent pas d'heure ensemble, un jour du lieu
 *   sautait (appareil à Paris, lieu New York, samedi 24 octobre 2026) ;
 * - le calendrier sous la date s'ouvrait sur le jour de l'appareil, quand
 *   l'en-tête montre celui du lieu (appareil à New York un soir, lieu
 *   Jérusalem où l'on est déjà le lendemain) ; choisir une date affichait le
 *   jour d'après.
 */

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
});

const newYork: ZmanimPlace = {
  source: "city",
  latitude: 40.7128,
  longitude: -74.006,
  tzid: "America/New_York",
  city: "New York",
};
const jerusalem: ZmanimPlace = {
  source: "city",
  latitude: 31.769,
  longitude: 35.2163,
  tzid: "Asia/Jerusalem",
  city: "Jérusalem",
};

const keys = (place: ZmanimPlace, now: Date, count: number) =>
  Array.from({ length: count }, (_, k) => placeDayKey(place, placeDayAfter(place, now, k)));

describe("les jours du lieu", () => {
  it("se suivent sans en sauter, la semaine où les heures ne changent pas ensemble", () => {
    process.env.TZ = "Europe/Paris";
    // Samedi 24 octobre 2026, 05:30 à Paris : vendredi 23, 23:30 à New York.
    const now = new Date(Date.UTC(2026, 9, 24, 3, 30));
    expect(keys(newYork, now, 4)).toEqual(["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"]);
  });

  it("se suivent sous n'importe quel fuseau d'appareil, autour des changements d'heure", () => {
    const starts = [
      Date.UTC(2026, 2, 27, 23),
      Date.UTC(2026, 9, 24, 3, 30),
      Date.UTC(2026, 10, 1, 5),
    ];
    for (const tz of [
      "UTC",
      "Europe/Paris",
      "America/Los_Angeles",
      "Asia/Jerusalem",
      "Pacific/Auckland",
    ]) {
      process.env.TZ = tz;
      for (const start of starts) {
        for (const place of [newYork, jerusalem]) {
          const days = keys(place, new Date(start), 8).map((key) => Date.parse(key));
          const gaps = days.slice(1).map((day, i) => Math.round((day - days[i]) / 86_400_000));
          expect(gaps).toEqual([1, 1, 1, 1, 1, 1, 1]);
        }
      }
    }
  });

  it("le calendrier s'ouvre sur le jour du lieu, et y ramène la date choisie", () => {
    process.env.TZ = "America/New_York";
    // Jeudi 1er octobre 2026, 20:00 à New York : vendredi 2 à Jérusalem.
    const now = new Date(Date.UTC(2026, 9, 2, 0));
    expect(placeDayKey(jerusalem, now)).toBe("2026-10-02");
    const offset = placeDayOffset(jerusalem, now, "2026-10-04")!;
    expect(offset).toBe(2);
    expect(placeDayKey(jerusalem, placeDayAfter(jerusalem, now, offset))).toBe("2026-10-04");
    expect(placeDayOffset(jerusalem, now, "pas une date")).toBeNull();
  });

  it("garde l'instant même pour aujourd'hui", () => {
    const now = new Date();
    expect(placeDayAfter(jerusalem, now, 0)).toBe(now);
  });

  it("les rappels d'un horaire n'oublient pas le samedi", () => {
    process.env.TZ = "Europe/Paris";
    // Samedi 24 octobre 2026, 05:30 à Paris : le lever du soleil de New York
    // du samedi est encore à venir, et doit être rappelé.
    const now = new Date(Date.UTC(2026, 9, 24, 3, 30));
    const planned = planZmanReminders({
      place: newYork,
      reminders: [{ key: "sunrise", minutesBefore: 10 }],
      rest: false,
      locale: "fr",
      now,
    });
    const days = planned.map((p) => placeDayKey(newYork, p.target));
    expect(days.slice(0, 3)).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"]);
  });
});
