import { afterEach, describe, expect, it } from "vitest";
import { HDate, months } from "@hebcal/core";
import {
  DEFAULT_PLACE,
  occasionEntryAt,
  restPeriodAt,
  type ZmanimPlace,
} from "../services/zmanimService";
import { planZmanReminders } from "../services/zmanReminderService";

/**
 * Le rappel « à l'entrée du jour » d'une date personnelle (hazkara,
 * anniversaire) : le moment d'allumer la bougie.
 *
 * Il tombait toujours au coucher du soleil de la veille. Quand la date est un
 * Chabbat, le Chabbat est déjà entré à cette heure-là : plus moyen d'allumer.
 * Quand elle suit un Chabbat, le rappel partait en plein Chabbat. Et la veille
 * se prenait à minuit de l'APPAREIL : un appareil à Paris réglé sur Montréal
 * recevait le rappel un jour trop tôt.
 *
 * Repères (Paris, 5787) : samedi 10 octobre 2026 = 29 Tichri ; dimanche
 * 11 octobre = 30 Tichri, Roch 'Hodech.
 */

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  // Affecter `undefined` écrirait la chaîne « undefined » : l'horloge
  // passerait en UTC pour la suite du fichier.
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

const montreal: ZmanimPlace = {
  source: "city",
  latitude: 45.5017,
  longitude: -73.5673,
  tzid: "America/Toronto",
  city: "Montréal",
};

const stockholm: ZmanimPlace = {
  source: "city",
  latitude: 59.3293,
  longitude: 18.0686,
  tzid: "Europe/Stockholm",
  city: "Stockholm",
};

/** Le jour civil d'un instant, dans le fuseau du lieu. */
const dayIn = (place: ZmanimPlace, date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: place.tzid }).format(date);

describe("l'entrée d'une date personnelle", () => {
  it("un samedi : à l'allumage du vendredi, avant l'entrée du Chabbat", () => {
    const hd = new HDate(29, months.TISHREI, 5787);
    expect(hd.getDay()).toBe(6);
    const at = occasionEntryAt(DEFAULT_PLACE, hd, "fr")!;
    expect(at.getTime()).toBe(restPeriodAt(DEFAULT_PLACE, hd, "fr")!.start.getTime());
    expect(dayIn(DEFAULT_PLACE, at)).toBe("2026-10-09");
  });

  it("un dimanche : à la sortie du Chabbat, pas au coucher du soleil", () => {
    const hd = new HDate(30, months.TISHREI, 5787);
    const at = occasionEntryAt(DEFAULT_PLACE, hd, "fr")!;
    const shabbat = restPeriodAt(DEFAULT_PLACE, hd.prev(), "fr")!;
    expect(at.getTime()).toBe(shabbat.end!.getTime());
    expect(dayIn(DEFAULT_PLACE, at)).toBe("2026-10-10");
  });

  it("un dimanche d'été à Stockholm : sans sortie du Chabbat calculable, le coucher du soleil", () => {
    // 15 Sivan 5787, dimanche 20 juin 2027 : la nuit ne tombe pas assez pour
    // que la sortie du Chabbat se calcule. Le rappel ne se perd pas pour autant.
    const hd = new HDate(15, months.SIVAN, 5787);
    expect(hd.getDay()).toBe(0);
    expect(restPeriodAt(stockholm, hd.prev(), "fr")!.end).toBeNull();
    const at = occasionEntryAt(stockholm, hd, "fr");
    expect(at).not.toBeNull();
    expect(dayIn(stockholm, at!)).toBe("2027-06-19");
  });

  it("le second jour d'une fête : à l'allumage de ce jour-là", () => {
    // 22 Tichri 5787 (diaspora) : Chemini Atseret, puis Sim'hat Torah le 23.
    const hd = new HDate(23, months.TISHREI, 5787);
    const period = restPeriodAt(DEFAULT_PLACE, hd, "fr")!;
    const lighting = period.lightings.find((l) => l.day.abs() === hd.abs())!;
    expect(occasionEntryAt(DEFAULT_PLACE, hd, "fr")!.getTime()).toBe(lighting.at.getTime());
  });

  it("un jour ordinaire : au coucher du soleil de la veille, au jour du lieu quel que soit l'appareil", () => {
    // Jeudi 1er octobre 2026 à Montréal : la veille est le mercredi 30.
    const hd = new HDate(new Date(2026, 9, 1, 12));
    for (const tz of ["Europe/Paris", "Asia/Jerusalem", "UTC", "America/Toronto"]) {
      process.env.TZ = tz;
      const at = occasionEntryAt(montreal, hd, "fr")!;
      expect(dayIn(montreal, at)).toBe("2026-09-30");
    }
  });

  it("c'est l'heure que prend le rappel programmé", () => {
    // Un leilouy nichmat au 29 Tichri, rappelé à l'entrée du jour : le plan
    // fait le samedi 10 octobre 2026 tombe le vendredi à l'allumage.
    const [planned] = planZmanReminders({
      place: DEFAULT_PLACE,
      reminders: [],
      rest: false,
      occasions: [
        {
          id: "o1",
          name: "David",
          kind: "yahrzeit",
          day: 29,
          month: months.TISHREI,
          reminder: "nightfall",
        },
      ],
      locale: "fr",
      now: new Date(Date.UTC(2026, 9, 1, 8)),
    });
    const hd = new HDate(29, months.TISHREI, 5787);
    expect(planned.at.getTime()).toBe(restPeriodAt(DEFAULT_PLACE, hd, "fr")!.start.getTime());
  });
});
