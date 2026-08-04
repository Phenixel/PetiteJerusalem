import { describe, it, expect } from "vitest";
import {
  computeZmanim,
  DEFAULT_PLACE,
  formatHebrewDate,
  formatZmanTime,
  getShabbatTimes,
  hebrewDateFor,
  nextZman,
  type ZmanimPlace,
} from "../services/zmanimService";

// Instants exprimés en UTC : les tests tournent aussi bien sous TZ=UTC (CI)
// que sous un fuseau local, et les heures attendues sont toujours celles de
// Paris, données par le fuseau du lieu et non par celui de la machine.
/** Mardi 4 août 2026, milieu de journée. */
const PARIS_DAY = new Date(Date.UTC(2026, 7, 4, 12));

const at = (place: ZmanimPlace, date: Date) => formatZmanTime(date, place.tzid, "fr");

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

describe("getShabbatTimes", () => {
  it("donne l'allumage du vendredi et la sortie du samedi", () => {
    // Mardi 4 août 2026 → Chabbat des 7 et 8 août.
    const shabbat = getShabbatTimes(DEFAULT_PLACE, PARIS_DAY)!;
    expect(shabbat.candleLighting.getDay()).toBe(5);
    expect(shabbat.havdalah.getDay()).toBe(6);
    expect(at(DEFAULT_PLACE, shabbat.candleLighting)).toBe("21:01");
    expect(at(DEFAULT_PLACE, shabbat.havdalah)).toBe("22:12");
  });

  it("garde le Chabbat en cours tant qu'il n'est pas sorti", () => {
    // Samedi 8 août 2026, 20 h (Paris) : la sortie n'a pas eu lieu, elle est le soir même.
    const saturdayEvening = new Date(Date.UTC(2026, 7, 8, 18)); // 20 h à Paris
    const shabbat = getShabbatTimes(DEFAULT_PLACE, saturdayEvening)!;
    expect(shabbat.havdalah.getDate()).toBe(8);
  });

  it("passe au Chabbat suivant une fois la sortie passée", () => {
    // Samedi 8 août 2026, 23 h (Paris) : sortie passée, on vise le 14/15 août.
    const afterHavdalah = new Date(Date.UTC(2026, 7, 8, 21)); // 23 h à Paris
    const shabbat = getShabbatTimes(DEFAULT_PLACE, afterHavdalah)!;
    expect(shabbat.candleLighting.getDate()).toBe(14);
    expect(shabbat.havdalah.getDate()).toBe(15);
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
