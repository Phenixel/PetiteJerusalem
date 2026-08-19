import { describe, it, expect } from "vitest";
import {
  computeZmanim,
  DEFAULT_PLACE,
  formatHebrewDate,
  formatZmanDay,
  formatZmanTime,
  hebrewDateFor,
  restPeriodsNear,
  weekdayIn,
  nextZman,
  slihotWindow,
  type ZmanimPlace,
} from "../services/zmanimService";

// Instants exprimés en UTC : les tests tournent aussi bien sous TZ=UTC (CI)
// que sous un fuseau local, et les heures attendues sont toujours celles de
// Paris, données par le fuseau du lieu et non par celui de la machine.
/** Mardi 4 août 2026, milieu de journée. */
const PARIS_DAY = new Date(Date.UTC(2026, 7, 4, 12));

const at = (place: ZmanimPlace, date: Date) => formatZmanTime(date, place.tzid, "fr");
/** Le jour tel qu'il est vécu au lieu, `getDay()` lirait celui de la machine. */
const on = (place: ZmanimPlace, date: Date) => formatZmanDay(date, place.tzid, "fr");

describe("computeZmanim", () => {
  it("calcule les horaires de Paris sans réseau", () => {
    const times = computeZmanim(DEFAULT_PLACE, PARIS_DAY);
    const byKey = new Map(times.map((zman) => [zman.key, zman.date]));

    // Valeurs de référence (Paris, 4 août 2026), au niveau de la mer.
    expect(at(DEFAULT_PLACE, byKey.get("sunrise")!)).toBe("06:27");
    expect(at(DEFAULT_PLACE, byKey.get("sofZmanShma")!)).toBe("10:12");
    expect(at(DEFAULT_PLACE, byKey.get("sofZmanShmaMGA")!)).toBe("09:36");
    expect(at(DEFAULT_PLACE, byKey.get("chatzot")!)).toBe("13:56");
    expect(at(DEFAULT_PLACE, byKey.get("sunset")!)).toBe("21:24");
    expect(at(DEFAULT_PLACE, byKey.get("tzeit")!)).toBe("22:20");
  });

  it("rend les horaires dans l'ordre chronologique", () => {
    for (const day of [
      new Date(Date.UTC(2026, 0, 15, 12)),
      PARIS_DAY,
      new Date(Date.UTC(2026, 11, 21, 12)),
    ]) {
      const times = computeZmanim(DEFAULT_PLACE, day);
      expect(times.length).toBe(14);
      for (let i = 1; i < times.length; i++) {
        expect(times[i].date.getTime()).toBeGreaterThan(times[i - 1].date.getTime());
      }
    }
  });

  it("suit le lieu : plus à l'ouest, le soleil se couche plus tard", () => {
    const brest: ZmanimPlace = {
      source: "device",
      latitude: 48.39,
      longitude: -4.49,
      tzid: "Europe/Paris",
      city: null,
    };
    const parisSunset = computeZmanim(DEFAULT_PLACE, PARIS_DAY).find((z) => z.key === "sunset")!;
    const brestSunset = computeZmanim(brest, PARIS_DAY).find((z) => z.key === "sunset")!;
    expect(brestSunset.date.getTime()).toBeGreaterThan(parisSunset.date.getTime());
  });

  it("affiche les heures dans le fuseau du lieu, pas celui du navigateur", () => {
    const jerusalem: ZmanimPlace = {
      source: "device",
      latitude: 31.7683,
      longitude: 35.2137,
      tzid: "Asia/Jerusalem",
      city: null,
    };
    const sunset = computeZmanim(jerusalem, PARIS_DAY).find((z) => z.key === "sunset")!;
    expect(formatZmanTime(sunset.date, "Asia/Jerusalem", "fr")).toBe("19:33");
  });
});

describe("nextZman", () => {
  it("donne le premier horaire encore à venir", () => {
    const times = computeZmanim(DEFAULT_PLACE, PARIS_DAY);
    const noon = new Date(Date.UTC(2026, 7, 4, 10)); // 12 h à Paris
    expect(nextZman(times, noon)?.key).toBe("chatzot");
  });

  it("ne renvoie rien une fois le dernier horaire passé", () => {
    const times = computeZmanim(DEFAULT_PLACE, PARIS_DAY);
    const lateNight = new Date(Date.UTC(2026, 7, 5, 3)); // 5 h du matin à Paris
    expect(nextZman(times, lateNight)).toBeNull();
  });
});

describe("restPeriodsNear : le Chabbat d'une semaine ordinaire", () => {
  /** Le premier temps de repos annoncé à cet instant-là. */
  const first = (date: Date) => restPeriodsNear(DEFAULT_PLACE, date, "fr")[0] ?? null;

  it("donne l'allumage du vendredi et la sortie du samedi", () => {
    // Mardi 4 août 2026 → Chabbat des 7 et 8 août.
    const shabbat = first(PARIS_DAY)!;
    expect(shabbat.festivals).toEqual([]);
    expect(on(DEFAULT_PLACE, shabbat.start)).toBe("vendredi 7 août");
    expect(on(DEFAULT_PLACE, shabbat.end)).toBe("samedi 8 août");
    expect(at(DEFAULT_PLACE, shabbat.start)).toBe("21:01");
    expect(at(DEFAULT_PLACE, shabbat.end)).toBe("22:12");
  });

  it("garde le Chabbat en cours tant qu'il n'est pas sorti", () => {
    // Samedi 8 août 2026, 20 h (Paris) : la sortie n'a pas eu lieu, elle est le soir même.
    const saturdayEvening = new Date(Date.UTC(2026, 7, 8, 18)); // 20 h à Paris
    expect(on(DEFAULT_PLACE, first(saturdayEvening)!.end)).toBe("samedi 8 août");
  });

  it("passe au Chabbat suivant une fois la sortie passée", () => {
    // Samedi 8 août 2026, 23 h (Paris) : sortie passée, on vise le 14/15 août.
    const afterHavdalah = new Date(Date.UTC(2026, 7, 8, 21)); // 23 h à Paris
    const shabbat = first(afterHavdalah)!;
    expect(on(DEFAULT_PLACE, shabbat.start)).toBe("vendredi 14 août");
    expect(on(DEFAULT_PLACE, shabbat.end)).toBe("samedi 15 août");
  });

  it("n'annonce qu'un seul Chabbat dans la semaine, sans fête", () => {
    // Du dimanche 2 au samedi 8 août 2026, à midi (Paris) : toujours celui du 8.
    for (let i = 0; i < 7; i++) {
      const periods = restPeriodsNear(DEFAULT_PLACE, new Date(Date.UTC(2026, 7, 2 + i, 10)), "fr");
      expect(periods).toHaveLength(1);
      expect(on(DEFAULT_PLACE, periods[0].end)).toBe("samedi 8 août");
    }
  });
});

describe("jour de la semaine", () => {
  const jerusalem: ZmanimPlace = {
    source: "device",
    latitude: 31.7683,
    longitude: 35.2137,
    tzid: "Asia/Jerusalem",
    city: null,
  };
  const newYork: ZmanimPlace = {
    source: "device",
    latitude: 40.7128,
    longitude: -74.006,
    tzid: "America/New_York",
    city: null,
  };

  it("compte les jours dans le fuseau du lieu", () => {
    // Vendredi 7 août 2026, 23 h à Paris, soit déjà samedi à Jérusalem, et
    // encore vendredi après-midi à New York.
    const instant = new Date(Date.UTC(2026, 7, 7, 21));
    expect(weekdayIn(DEFAULT_PLACE, instant)).toBe(5);
    expect(weekdayIn(jerusalem, instant)).toBe(6);
    expect(weekdayIn(newYork, instant)).toBe(5);
  });
});

describe("date hébraïque", () => {
  it("bascule au coucher du soleil pour aujourd'hui", () => {
    // Chkia à 21 h 24 (Paris) : 21 h est encore le 21 Av, 22 h est déjà le 22.
    const beforeSunset = new Date(Date.UTC(2026, 7, 4, 19));
    const afterSunset = new Date(Date.UTC(2026, 7, 4, 20));
    const before = hebrewDateFor(DEFAULT_PLACE, beforeSunset, beforeSunset);
    const after = hebrewDateFor(DEFAULT_PLACE, afterSunset, afterSunset);
    expect(after.getDate()).toBe(before.getDate() + 1);
  });

  it("se rend en français, en anglais et en hébreu", () => {
    const hd = hebrewDateFor(DEFAULT_PLACE, PARIS_DAY, PARIS_DAY);
    expect(formatHebrewDate(hd, "fr")).toBe("21 Av 5786");
    expect(formatHebrewDate(hd, "en")).toBe("21st of Av, 5786");
    expect(formatHebrewDate(hd, "he")).toContain("אָב");
  });
});

describe("plage des Sli'hot", () => {
  it("va de hatsot au lever du soleil de la nuit qui vient", () => {
    // Mardi 4 août 2026, midi : le jour est levé, la plage annoncée est celle
    // de la nuit du 4 au 5.
    const window = slihotWindow(DEFAULT_PLACE, PARIS_DAY)!;
    expect(window.tonight).toBe(false);
    expect(at(DEFAULT_PLACE, window.start)).toBe("01:56");
    expect(at(DEFAULT_PLACE, window.end)).toBe("06:29");
    expect(on(DEFAULT_PLACE, window.end)).toContain("5");
    expect(window.start.getTime()).toBeLessThan(window.end.getTime());
  });

  it("avant le lever du soleil, c'est encore la nuit en cours", () => {
    // Mercredi 5 août 2026, 4 h à Paris : on est dans la plage.
    const beforeDawn = new Date(Date.UTC(2026, 7, 5, 2));
    const window = slihotWindow(DEFAULT_PLACE, beforeDawn)!;
    expect(window.tonight).toBe(true);
    expect(window.start.getTime()).toBeLessThan(beforeDawn.getTime());
    expect(window.end.getTime()).toBeGreaterThan(beforeDawn.getTime());
  });
});
