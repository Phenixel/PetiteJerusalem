// @vitest-environment node
import { describe, expect, it } from "vitest";
import citiesJson from "../datas/cities.json";
import { resetIntlCache } from "../services/intlCache";
import {
  computeZmanim,
  fastAt,
  formatMarkerDay,
  hebrewDayOf,
  restPeriodAt,
  setZmanimOpinion,
  zmanimGap,
  type ZmanimPlace,
} from "../services/zmanimService";

/**
 * La matrice de l'audit, rejouée (voir `docs/audit-horaires-2026-09.md`,
 * section 1, et le lot 11 du plan).
 *
 * L'audit avait balayé 59 lieux du globe, 30 dates éprouvantes et trois
 * fuseaux d'appareil, et n'y avait trouvé qu'un défaut : le décalage d'une
 * heure du point 3.1. Ce fichier rejoue ce balayage à demeure, pour que le
 * défaut ne puisse pas revenir sans qu'on le sache.
 *
 * Ce qu'il tient : un horaire est un INSTANT. Il ne dépend que du lieu
 * affiché, de la date et de l'avis suivi. Le fuseau de la MACHINE ne doit
 * jamais le déplacer, ni pour la liste du jour, ni pour un bloc de repos, ni
 * pour un jeûne. C'est le seul invariant qui se vérifie sans connaître aucune
 * heure juste, et c'est pour cela qu'il balaye si large.
 *
 * Deux champs font exception, et ce n'est pas un défaut : `shabbat` et
 * `eruvTavshilin` ne sont pas des instants mais des MARQUEURS DE JOUR, posés
 * au midi local de la machine (voir `civilNoon`). On les compare donc dans
 * LEUR repère, celui de la machine, comme la page les rend
 * (`formatMarkerDay`) : c'est ce balayage qui a montré qu'on les rendait
 * ailleurs, et qu'un appareil d'Auckland lisait un jour de moins en regardant
 * New York.
 */

type City = { name: string; country: string; lat: number; lon: number; tz: string };
const CITIES = citiesJson as City[];

/**
 * 59 lieux : cinquante villes prises à intervalle régulier dans le catalogue,
 * et neuf positions d'appareil choisies pour leurs fuseaux difficiles. La Paz
 * et Quito pour l'équateur, Tromsø, Reykjavik et Anchorage pour le cercle
 * polaire, Katmandou (+5:45) et Lord Howe (+10:30/+11) pour leurs demi-heures,
 * Casablanca qui change d'heure pendant le ramadan, Sydney pour l'hémisphère
 * sud.
 */
const step = Math.floor(CITIES.length / 50);
const PLACES: ZmanimPlace[] = CITIES.filter((_, index) => index % step === 0)
  .slice(0, 50)
  .map((city) => ({
    source: "city",
    latitude: city.lat,
    longitude: city.lon,
    tzid: city.tz,
    city: city.name,
  }));
for (const [latitude, longitude, tzid] of [
  [-16.5, -68.15, "America/La_Paz"],
  [-0.18, -78.47, "America/Guayaquil"],
  [69.65, 18.96, "Europe/Oslo"],
  [64.13, -21.9, "Atlantic/Reykjavik"],
  [61.22, -149.9, "America/Anchorage"],
  [27.72, 85.32, "Asia/Kathmandu"],
  [-31.55, 159.08, "Australia/Lord_Howe"],
  [33.57, -7.59, "Africa/Casablanca"],
  [-33.87, 151.21, "Australia/Sydney"],
] as const) {
  PLACES.push({ source: "device", latitude, longitude, tzid, city: null });
}

/**
 * 30 dates : les quatre tournants de deux années, les jours de changement
 * d'heure de six pays, les six jeûnes, les fêtes qui font des blocs de
 * plusieurs jours, et un Chabbat ordinaire pour témoin.
 */
const DAYS: Date[] = (
  [
    [2026, 3, 20],
    [2026, 6, 21],
    [2026, 9, 22],
    [2026, 12, 21],
    [2027, 3, 20],
    [2027, 6, 21],
    [2027, 9, 23],
    [2027, 12, 22],
    [2026, 3, 29],
    [2026, 10, 25],
    [2026, 11, 1],
    [2026, 3, 8],
    [2027, 3, 14],
    [2026, 3, 27],
    [2026, 10, 30],
    [2026, 4, 5],
    [2026, 9, 14],
    [2026, 9, 21],
    [2026, 10, 2],
    [2026, 12, 20],
    [2027, 3, 22],
    [2027, 4, 1],
    [2027, 7, 22],
    [2027, 8, 12],
    [2026, 9, 12],
    [2027, 4, 22],
    [2029, 5, 20],
    [2026, 12, 5],
    [2027, 2, 22],
    [2026, 8, 8],
  ] as const
).map(([y, m, d]) => new Date(Date.UTC(y, m - 1, d, 12)));

/** Les trois fuseaux d'appareil de l'audit : le neutre, l'extrême est, l'ouest. */
const TIMEZONES = ["UTC", "Pacific/Auckland", "America/Los_Angeles"];

/** Le balayage est long par construction : on lui laisse de quoi finir. */
const SWEEP_TIMEOUT = 300_000;

describe("la matrice de l'audit", () => {
  it(
    "donne les mêmes instants sous les trois fuseaux d'appareil",
    () => {
      const original = process.env.TZ;
      const reference = new Map<string, string>();
      const anomalies: string[] = [];
      let rows = 0;

      for (const tzid of TIMEZONES) {
        process.env.TZ = tzid;
        // Les formateurs sont mémoïsés, et celui qui n'a pas de fuseau
        // EXPLICITE garde celui de la machine au moment où il a été créé :
        // sans ce vidage, le balayage comparerait des jours rendus sous
        // l'ancien fuseau (voir services/intlCache).
        resetIntlCache();
        for (const opinion of ["posen", "ovadia"] as const) {
          // Change d'opinion, et vide au passage ce qui a été calculé sous
          // l'ancien fuseau : c'est le seul point d'entrée qui purge.
          setZmanimOpinion(opinion === "posen" ? "ovadia" : "posen");
          setZmanimOpinion(opinion);

          for (const place of PLACES) {
            for (const day of DAYS) {
              const label = `${place.city ?? place.tzid}|${day.toISOString().slice(0, 10)}|${opinion}`;
              const compare = (key: string, value: string) => {
                rows++;
                if (tzid === TIMEZONES[0]) reference.set(key, value);
                else if (reference.get(key) !== value) anomalies.push(`${key} sous ${tzid}`);
              };

              for (const zman of computeZmanim(place, day)) {
                compare(`${label}|${zman.key}`, zman.exact.toISOString());
              }
              // Le jour hébraïque DU LIEU : `new HDate(date)` lirait les
              // champs locaux de la machine, et sauterait un jour sous
              // Auckland.
              const hd = hebrewDayOf(place, day);
              const rest = restPeriodAt(place, hd, "fr");
              if (rest) {
                const asDay = (date: Date | null) =>
                  date ? formatMarkerDay(date, "fr") : "-";
                compare(
                  `${label}|rest`,
                  [
                    rest.start.toISOString(),
                    rest.end?.toISOString() ?? "-",
                    rest.lightings.map((l) => `${l.rule}@${l.at.toISOString()}`).join(","),
                    // Marqueurs de jour : comparés comme la page les rend.
                    asDay(rest.eruvTavshilin),
                    asDay(rest.shabbat),
                  ].join("|"),
                );
              }
              const fast = fastAt(place, hd, "fr");
              if (fast) {
                compare(
                  `${label}|fast`,
                  `${fast.start?.toISOString() ?? "-"}|${fast.end.toISOString()}`,
                );
              }
              // Appelé pour lui-même : il ne doit jamais lever, même au pôle.
              zmanimGap(place, day);
            }
          }
        }
      }

      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
      setZmanimOpinion("posen");

      // Plus de cent cinquante mille lignes : si le compte s'effondrait, le
      // balayage ne vérifierait plus rien sans le dire.
      expect(rows).toBeGreaterThan(100_000);
      expect(anomalies.slice(0, 10)).toEqual([]);
    },
    SWEEP_TIMEOUT,
  );
});
