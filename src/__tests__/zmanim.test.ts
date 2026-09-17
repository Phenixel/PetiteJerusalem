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
  ZMAN_ROUNDING,
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
    // Le netz ouvre le temps de la Amida du matin : un DÉBUT, qui monte à la
    // minute supérieure (06:27:44, donc 06:28).
    expect(at(DEFAULT_PLACE, byKey.get("sunrise")!)).toBe("06:28");
    expect(at(DEFAULT_PLACE, byKey.get("sofZmanShma")!)).toBe("10:12");
    // Le Maguen Avraham du Rav Posen compte de l'aube (16,1°) à la nuit.
    expect(at(DEFAULT_PLACE, byKey.get("sofZmanShmaMGA")!)).toBe("09:10");
    expect(at(DEFAULT_PLACE, byKey.get("chatzot")!)).toBe("13:56");
    expect(at(DEFAULT_PLACE, byKey.get("sunset")!)).toBe("21:24");
    // La sortie des étoiles est une FIN : 22:20:14 monte à 22:21, et non à
    // 22:20, qui la donnerait quatorze secondes trop tôt (voir ZmanRounding).
    expect(at(DEFAULT_PLACE, byKey.get("tzeit")!)).toBe("22:21");
  });

  it("rend les horaires dans l'ordre chronologique", () => {
    for (const day of [
      new Date(Date.UTC(2026, 0, 15, 12)),
      PARIS_DAY,
      new Date(Date.UTC(2026, 11, 21, 12)),
    ]) {
      const times = computeZmanim(DEFAULT_PLACE, day);
      expect(times.length).toBe(15);
      for (let i = 1; i < times.length; i++) {
        expect(times[i].date.getTime()).toBeGreaterThan(times[i - 1].date.getTime());
      }
    }
  });

  it("ouvre le jour sur le milieu de la nuit en cours", () => {
    // Après minuit, le jour civil a changé mais le milieu de sa nuit n'est pas
    // forcément passé : il ouvre la liste du jour, et c'est le même instant
    // que le « milieu de la nuit qui vient » de la veille.
    const wednesday = new Date(Date.UTC(2026, 7, 5, 12));
    const dawn = computeZmanim(DEFAULT_PLACE, wednesday)[0];
    expect(dawn.key).toBe("chatzotNightDawn");
    expect(dawn.period).toBe("dawn");
    const eveOfTuesday = computeZmanim(DEFAULT_PLACE, PARIS_DAY).find(
      (zman) => zman.key === "chatzotNight",
    )!;
    expect(dawn.date.getTime()).toBe(eveOfTuesday.date.getTime());
    // Vers 2 h du matin à Paris : le prochain horaire est bien celui-là.
    const afterMidnight = new Date(Date.UTC(2026, 7, 4, 23, 30));
    expect(nextZman(computeZmanim(DEFAULT_PLACE, wednesday), afterMidnight)?.key).toBe(
      "chatzotNightDawn",
    );
  });

  it("ne rattache pas au jour un milieu de nuit tombé la veille", () => {
    // À l'est du méridien de son fuseau, le milieu de la nuit tombe avant
    // minuit : à Jérusalem le 15 janvier 2026, celui de la nuit en cours est
    // le 14 à 23 h 48. C'est la soirée du 14 qui le porte, pas le 15.
    const jerusalem: ZmanimPlace = {
      source: "device",
      latitude: 31.7683,
      longitude: 35.2137,
      tzid: "Asia/Jerusalem",
      city: null,
    };
    const winterDay = new Date(Date.UTC(2026, 0, 15, 12));
    const winter = computeZmanim(jerusalem, winterDay);
    expect(winter[0].key).not.toBe("chatzotNightDawn");
    // L'été (heure d'été), il repasse après minuit et revient dans le jour.
    const summer = computeZmanim(jerusalem, PARIS_DAY);
    expect(summer[0].key).toBe("chatzotNightDawn");
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

describe("arrondi des horaires à la minute", () => {
  /**
   * Une LIMITE se coupe vers le bas, une FIN monte à la minute supérieure
   * (voir ZmanRounding dans zmanimService). Le test ne recopie pas la liste
   * des sens, il la lit (`ZMAN_ROUNDING`) et la confronte à l'instant exact,
   * que `ZmanTime.exact` conserve.
   *
   * Quatre jours de saisons différentes et deux lieux, dont un à l'est de son
   * méridien : de quoi passer sur des horaires à zéro seconde comme sur des
   * horaires qui en portent.
   */
  const DAYS = [
    new Date(Date.UTC(2026, 0, 15, 12)),
    new Date(Date.UTC(2026, 2, 20, 12)),
    PARIS_DAY,
    new Date(Date.UTC(2026, 11, 21, 12)),
  ];
  const jerusalem: ZmanimPlace = {
    source: "city",
    latitude: 31.7683,
    longitude: 35.2137,
    tzid: "Asia/Jerusalem",
    city: "Jérusalem",
  };

  it("coupe chaque horaire dans le sens que sa nature commande", () => {
    for (const place of [DEFAULT_PLACE, jerusalem]) {
      for (const day of DAYS) {
        for (const zman of computeZmanim(place, day)) {
          const shown = zman.date.getTime();
          const exact = zman.exact.getTime();
          // Toujours une minute pleine, jamais de secondes affichées.
          expect(zman.date.getSeconds(), `${zman.key} porte des secondes`).toBe(0);
          expect(zman.date.getMilliseconds()).toBe(0);
          // Et jamais plus d'une minute de l'instant calculé.
          expect(Math.abs(shown - exact)).toBeLessThan(60_000);
          if (ZMAN_ROUNDING[zman.key] === "up") {
            // Une FIN ne s'annonce jamais avant l'instant où elle a lieu.
            expect(shown, `${zman.key} annoncé avant son instant`).toBeGreaterThanOrEqual(exact);
          } else {
            // Une LIMITE ne s'annonce jamais après.
            expect(shown, `${zman.key} annoncé après son instant`).toBeLessThanOrEqual(exact);
          }
        }
      }
    }
  });

  it("monte les fins et descend les limites des cadres", () => {
    // Chabbat du 8 août 2026 à Paris : sortie 22:12:39, donc 22:13 ; allumage
    // du vendredi déjà rond (21:01:00). Tzom Guedalia du 14 septembre :
    // aube 05:48:46, donc 05:48, fin 20:44:19, donc 20:45.
    const shabbat = restPeriodsNear(DEFAULT_PLACE, PARIS_DAY, "fr")[0];
    expect(shabbat.end!.getSeconds()).toBe(0);
    expect(shabbat.start.getSeconds()).toBe(0);
    expect(at(DEFAULT_PLACE, shabbat.end!)).toBe("22:13");

    // La plage des Sli'hot : hatsot ouvre (minute supérieure), le netz ferme.
    const window = slihotWindow(DEFAULT_PLACE, PARIS_DAY)!;
    expect(window.start.getSeconds()).toBe(0);
    expect(window.end.getSeconds()).toBe(0);
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
    expect(on(DEFAULT_PLACE, shabbat.end!)).toBe("samedi 8 août");
    expect(at(DEFAULT_PLACE, shabbat.start)).toBe("21:01");
    // Sortie du Chabbat (8,5°) à 22:12:39 le samedi 8 août : une FIN, donc
    // 22:13. L'afficher 22:12 relâcherait le Chabbat trente-neuf secondes
    // trop tôt (voir ZmanRounding).
    expect(at(DEFAULT_PLACE, shabbat.end!)).toBe("22:13");
    // Sortie selon Rabbénou Tam : 72 minutes après la chkia (21 h 18 ce
    // samedi-là), après la sortie ordinaire.
    expect(at(DEFAULT_PLACE, shabbat.endRabbenouTam!)).toBe("22:30");
    expect(shabbat.endRabbenouTam!.getTime()).toBeGreaterThan(shabbat.end!.getTime());
  });

  it("garde le Chabbat en cours tant qu'il n'est pas sorti", () => {
    // Samedi 8 août 2026, 20 h (Paris) : la sortie n'a pas eu lieu, elle est le soir même.
    const saturdayEvening = new Date(Date.UTC(2026, 7, 8, 18)); // 20 h à Paris
    expect(on(DEFAULT_PLACE, first(saturdayEvening)!.end!)).toBe("samedi 8 août");
  });

  it("passe au Chabbat suivant une fois la sortie passée", () => {
    // Samedi 8 août 2026, 23 h (Paris) : sortie passée, on vise le 14/15 août.
    const afterHavdalah = new Date(Date.UTC(2026, 7, 8, 21)); // 23 h à Paris
    const shabbat = first(afterHavdalah)!;
    expect(on(DEFAULT_PLACE, shabbat.start)).toBe("vendredi 14 août");
    expect(on(DEFAULT_PLACE, shabbat.end!)).toBe("samedi 15 août");
  });

  it("n'annonce qu'un seul Chabbat dans la semaine, sans fête", () => {
    // Du dimanche 2 au samedi 8 août 2026, à midi (Paris) : toujours celui du 8.
    for (let i = 0; i < 7; i++) {
      const periods = restPeriodsNear(DEFAULT_PLACE, new Date(Date.UTC(2026, 7, 2 + i, 10)), "fr");
      expect(periods).toHaveLength(1);
      expect(on(DEFAULT_PLACE, periods[0].end!)).toBe("samedi 8 août");
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
    // Hatsot OUVRE la plage (01:56:57, donc 01:57 : on ne dit pas les Sli'hot
    // trois secondes trop tôt), le netz la FERME (06:29:13, donc 06:29).
    expect(at(DEFAULT_PLACE, window.start)).toBe("01:57");
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
