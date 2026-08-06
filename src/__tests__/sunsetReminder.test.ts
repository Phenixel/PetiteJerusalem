import { describe, expect, it } from "vitest";
import { GeoLocation, Zmanim } from "@hebcal/core";
import {
  coarsePlace,
  DEFAULT_PLACE,
  getSunset,
  SUNSET_REMINDER_OFFSET_MINUTES,
  sunsetReminderAt,
  type ZmanimPlace,
} from "../services/zmanimService";
import {
  isInCurrentSlot,
  readPlace,
  sunsetOn,
  sunsetReminderAt as serverSunsetReminderAt,
} from "../../functions/src/sunsetReminder";

/**
 * Le rappel « dernier appel » part 20 minutes avant la chkia, décidé par la
 * Cloud Function. Elle ne peut pas utiliser `@hebcal/core` (publié en ESM seul,
 * alors que functions/ compile en CommonJS) et refait donc le calcul solaire
 * dans functions/src/sunset.ts : ces tests vérifient qu'elle annonce bien la
 * même chkia que celle affichée dans l'application.
 */

/** Mardi 4 août 2026, milieu de journée — même repère que zmanim.test.ts. */
const PARIS_DAY = new Date(Date.UTC(2026, 7, 4, 12));

const PLACES: { name: string; place: ZmanimPlace }[] = [
  { name: "Paris", place: DEFAULT_PLACE },
  {
    name: "Jérusalem",
    place: {
      source: "city",
      latitude: 31.76904,
      longitude: 35.21633,
      tzid: "Asia/Jerusalem",
      city: "Jerusalem",
    },
  },
  {
    name: "New York",
    place: {
      source: "city",
      latitude: 40.71427,
      longitude: -74.00597,
      tzid: "America/New_York",
      city: "New York",
    },
  },
  {
    name: "Melbourne",
    place: {
      source: "city",
      latitude: -37.814,
      longitude: 144.96332,
      tzid: "Australia/Melbourne",
      city: "Melbourne",
    },
  },
];

describe("sunsetOn (calcul serveur)", () => {
  it("donne la même chkia que hebcal, partout et en toute saison", () => {
    // Solstices et équinoxes : les deux moments où la déclinaison solaire est
    // extrême, et celui où elle bouge le plus vite.
    const divergences: string[] = [];
    for (const { name, place } of PLACES) {
      for (const [month, day] of [
        [1, 15],
        [3, 21],
        [6, 21],
        [9, 23],
        [12, 21],
      ]) {
        const reference = new Zmanim(
          new GeoLocation("", place.latitude, place.longitude, 0, place.tzid),
          new Date(2026, month - 1, day, 12),
          false,
        ).sunset();
        const computed = sunsetOn(2026, month, day, place.latitude, place.longitude);
        const gap =
          computed === null ? Infinity : Math.abs(reference.getTime() - computed.getTime()) / 1000;
        // Cinq secondes : sans commune mesure avec les créneaux de 5 minutes du
        // scheduler, mais assez serré pour repérer une formule qui dérive.
        if (!(gap < 5)) divergences.push(`${name} ${day}/${month} : ${gap.toFixed(1)} s`);
      }
    }
    expect(divergences).toEqual([]);
  });

  it("ne renvoie rien là où le soleil ne se couche pas", () => {
    // Tromsø, au-delà du cercle polaire : soleil de minuit en juin, nuit
    // polaire en décembre — le rappel d'avant-chkia n'a alors rien à viser.
    expect(sunsetOn(2026, 6, 21, 69.6496, 18.956)).toBeNull();
    expect(sunsetOn(2026, 12, 21, 69.6496, 18.956)).toBeNull();
  });
});

describe("sunsetReminderAt", () => {
  it("vise 20 minutes avant la chkia", () => {
    const sunset = getSunset(DEFAULT_PLACE, PARIS_DAY)!;
    const target = sunsetReminderAt(DEFAULT_PLACE, PARIS_DAY)!;
    expect((sunset.getTime() - target.getTime()) / 60_000).toBe(SUNSET_REMINDER_OFFSET_MINUTES);
  });

  it("serveur et application visent le même instant", () => {
    const divergences: string[] = [];
    for (const { name, place } of PLACES) {
      const client = sunsetReminderAt(place, PARIS_DAY)!;
      const server = serverSunsetReminderAt(
        { latitude: place.latitude, longitude: place.longitude, tzid: place.tzid },
        PARIS_DAY,
      );
      const gap =
        server === null ? Infinity : Math.abs(client.getTime() - server.getTime()) / 1000;
      if (!(gap < 5)) divergences.push(`${name} : ${gap.toFixed(1)} s`);
    }
    expect(divergences).toEqual([]);
  });

  it("calcule le jour tel qu'il est vécu au lieu, pas à Paris", () => {
    const newYork = PLACES[2].place;
    // 00 h 30 le 5 août à Paris : à New York on est encore le 4 au soir, et
    // c'est la chkia du 4 qui vient de passer, pas celle du 5.
    const parisAfterMidnight = new Date(Date.UTC(2026, 7, 4, 22, 30));
    const server = serverSunsetReminderAt(
      { latitude: newYork.latitude, longitude: newYork.longitude, tzid: newYork.tzid },
      parisAfterMidnight,
    )!;
    const localDay = new Intl.DateTimeFormat("en-CA", { timeZone: newYork.tzid }).format(server);
    expect(localDay).toBe("2026-08-04");
  });

  it("ignore un fuseau que le serveur ne connaît pas", () => {
    expect(
      serverSunsetReminderAt({ latitude: 48.85, longitude: 2.35, tzid: "Nowhere/Land" }, PARIS_DAY),
    ).toBeNull();
  });
});

describe("readPlace", () => {
  it("retombe sur Paris quand le lieu est absent ou incomplet", () => {
    const paris = { latitude: 48.85341, longitude: 2.3488, tzid: "Europe/Paris" };
    // Rappel d'avant-chkia activé sans lieu (profil d'une autre version), ou
    // document trafiqué : le repli parisien vaut mieux qu'un silence.
    expect(readPlace(undefined)).toEqual(paris);
    expect(readPlace(null)).toEqual(paris);
    expect(readPlace({ latitude: 31.7, tzid: "Asia/Jerusalem" })).toEqual(paris);
    expect(readPlace({ latitude: 31.7, longitude: 35.2, tzid: "" })).toEqual(paris);
  });

  it("garde un lieu complet", () => {
    const place = { latitude: 31.8, longitude: 35.2, tzid: "Asia/Jerusalem" };
    expect(readPlace({ ...place, intrus: "x" })).toEqual(place);
  });
});

describe("isInCurrentSlot", () => {
  // Le scheduler tourne toutes les 5 minutes : un rappel part dans le créneau
  // qui contient son instant, une seule fois.
  const slotOf = (iso: string) => new Date(iso);

  it("retient l'instant tombant dans le créneau en cours", () => {
    expect(isInCurrentSlot(slotOf("2026-08-04T19:02:30Z"), slotOf("2026-08-04T19:00:04Z"))).toBe(
      true,
    );
    // Bornes : le début du créneau en fait partie, la fin appartient au suivant.
    expect(isInCurrentSlot(slotOf("2026-08-04T19:00:00Z"), slotOf("2026-08-04T19:00:04Z"))).toBe(
      true,
    );
    expect(isInCurrentSlot(slotOf("2026-08-04T19:05:00Z"), slotOf("2026-08-04T19:00:04Z"))).toBe(
      false,
    );
  });

  it("laisse passer les créneaux précédents et suivants", () => {
    expect(isInCurrentSlot(slotOf("2026-08-04T18:58:00Z"), slotOf("2026-08-04T19:00:04Z"))).toBe(
      false,
    );
    expect(isInCurrentSlot(slotOf("2026-08-04T19:12:00Z"), slotOf("2026-08-04T19:00:04Z"))).toBe(
      false,
    );
  });

  it("n'envoie qu'une fois quand le scheduler balaie la journée", () => {
    const target = slotOf("2026-08-04T19:02:30Z");
    let hits = 0;
    for (let minute = 0; minute < 24 * 60; minute += 5) {
      const now = new Date(Date.UTC(2026, 7, 4, 0, minute, 4));
      if (isInCurrentSlot(target, now)) hits++;
    }
    expect(hits).toBe(1);
  });
});

describe("coarsePlace", () => {
  it("arrondit la position au dixième de degré avant de l'envoyer", () => {
    const device: ZmanimPlace = {
      source: "device",
      latitude: 48.976_432,
      longitude: 2.312_87,
      tzid: "Europe/Paris",
      city: null,
    };
    expect(coarsePlace(device)).toEqual({
      latitude: 49,
      longitude: 2.3,
      tzid: "Europe/Paris",
    });
  });

  it("ne décale pas la chkia de façon perceptible", () => {
    const device: ZmanimPlace = {
      source: "device",
      latitude: 48.976_432,
      longitude: 2.312_87,
      tzid: "Europe/Paris",
      city: null,
    };
    const exact = getSunset(device, PARIS_DAY)!;
    const rounded = getSunset({ ...device, ...coarsePlace(device) }, PARIS_DAY)!;
    // Moins d'une minute d'écart, quand le rappel part par créneaux de 5.
    expect(Math.abs(exact.getTime() - rounded.getTime())).toBeLessThan(60_000);
  });
});
