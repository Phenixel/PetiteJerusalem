import { describe, expect, it } from "vitest";
import { flags, GeoLocation, getHolidaysOnDate, HDate, months, Zmanim } from "@hebcal/core";
import citiesJson from "../datas/cities.json";
import {
  candleLightingMinutes,
  computeZmanim,
  fastAt,
  getSunset,
  restPeriodAt,
  ZMAN_KEYS,
  zmanimGap,
  type ZmanimPlace,
} from "../services/zmanimService";

/**
 * Le balayage : les mêmes horaires, refaits jour après jour sur plusieurs
 * années et plusieurs villes, et vérifiés non pas contre une heure attendue
 * mais contre ce qui doit rester vrai partout.
 *
 * Les tests de référence (voir zmanim.test.ts) tiennent une poignée de valeurs
 * à Paris : ils attrapent une erreur de définition, jamais une erreur qui ne
 * se montre qu'ailleurs ou qu'à une saison. Une aube qui passe après le lever
 * au-delà du cercle polaire, un allumage calculé sur le mauvais soir quand
 * une fête touche le Chabbat, un jeûne de quarante minutes parce que la
 * sortie se lit sur le mauvais jour : ces bizarreries-là ne se voient qu'en
 * parcourant l'année entière, et c'est ce que fait ce fichier.
 *
 * Deux balayages, parce qu'ils ne coûtent pas la même chose :
 *
 *  - une poignée de villes choisies pour ce qu'elles mettent à l'épreuve, jour
 *    après jour sur deux ans : deux cycles solaires entiers, et les quatre
 *    changements d'heure qui vont avec. Paris et Marseille pour le
 *    public de l'application, Jérusalem pour le calendrier d'Israël (Yom Tov
 *    d'un seul jour), New York pour un fuseau dont la chkia tombe après
 *    minuit UTC, Buenos Aires pour l'hémisphère sud, où les saisons
 *    s'inversent ;
 *  - les 243 villes du catalogue (src/datas/cities.json), 46 pays et 56
 *    fuseaux, aux seuls jours qui mettent à l'épreuve : les solstices, les
 *    équinoxes, et deux jours par mois. Balayer le catalogue entier jour
 *    après jour prendrait deux minutes ; c'est là qu'on a trouvé la fin de la
 *    Amida qui s'affichait au-dessus d'une fin du Chéma plus tardive au nord
 *    de l'Angleterre, et c'est cet ordre-là que ce balayage tient.
 */

const PLACES: ZmanimPlace[] = [
  { source: "city", latitude: 48.85341, longitude: 2.3488, tzid: "Europe/Paris", city: "Paris" },
  { source: "city", latitude: 43.2965, longitude: 5.3698, tzid: "Europe/Paris", city: "Marseille" },
  {
    source: "city",
    latitude: 31.7683,
    longitude: 35.2137,
    tzid: "Asia/Jerusalem",
    city: "Jérusalem",
  },
  {
    source: "city",
    latitude: 40.7128,
    longitude: -74.006,
    tzid: "America/New_York",
    city: "New York",
  },
  {
    source: "city",
    latitude: -34.6037,
    longitude: -58.3816,
    tzid: "America/Argentina/Buenos_Aires",
    city: "Buenos Aires",
  },
];

/** L'ordre dans lequel la journée doit les donner, quand ils existent tous. */
const DAY_ORDER = [
  "alotHaShachar",
  "misheyakir",
  "sunrise",
  "sofZmanShmaMGA",
  "sofZmanShma",
  "sofZmanTfillaMGA",
  "sofZmanTfilla",
  "chatzot",
  "minchaGedola",
  "minchaKetana",
  "plagHaMincha",
  "sunset",
  "tzeit",
];

/** Minutes entre deux instants. */
const minutes = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 60_000;

/** Le jour civil d'une date hébraïque, à midi. */
const civilNoon = (hd: HDate): Date => {
  const greg = hd.greg();
  return new Date(greg.getFullYear(), greg.getMonth(), greg.getDate(), 12);
};

const label = (place: ZmanimPlace, day: Date) => `${place.city} ${day.toISOString().slice(0, 10)}`;

/**
 * Le délai laissé à un balayage, en millisecondes.
 *
 * vitest coupe un test au bout de cinq secondes, et un balayage de trois ans
 * sur cinq villes en prend trois ou quatre sur une machine de développement :
 * il passait ici et tombait sur l'intégration continue, plus lente, avec un
 * « Test timed out » qui ne dit rien des horaires. Ces tests sont longs par
 * construction et non par accident ; on leur laisse donc de quoi finir, avec
 * une marge qui tient même sur une machine chargée.
 */
const SWEEP_TIMEOUT = 60_000;

describe("les horaires du jour, tout au long de l'année", () => {
  it(
    "se suivent dans l'ordre, partout et en toute saison",
    () => {
      const anomalies: string[] = [];
      for (const place of PLACES) {
        for (let i = 0; i < 365 * 2; i++) {
          const day = new Date(2026, 0, 1, 12);
          day.setDate(day.getDate() + i);
          const times = computeZmanim(place, day);
          const byKey = new Map<string, Date>(times.map((zman) => [zman.key, zman.date]));
          const tag = label(place, day);

          // La liste rendue est chronologique : c'est elle que la page affiche.
          for (let k = 1; k < times.length; k++) {
            if (times[k].date.getTime() <= times[k - 1].date.getTime()) {
              anomalies.push(`${tag} : ${times[k - 1].key} n'est pas avant ${times[k].key}`);
            }
          }
          // Et les horaires présents tombent dans l'ordre attendu de la journée.
          const present = DAY_ORDER.filter((key) => byKey.has(key));
          for (let k = 1; k < present.length; k++) {
            if (byKey.get(present[k])!.getTime() <= byKey.get(present[k - 1])!.getTime()) {
              anomalies.push(`${tag} : ${present[k - 1]} n'est pas avant ${present[k]}`);
            }
          }
        }
      }
      expect(anomalies.slice(0, 20)).toEqual([]);
    },
    SWEEP_TIMEOUT,
  );

  it(
    "tiennent les rapports qui définissent chaque zman",
    () => {
      const anomalies: string[] = [];
      for (const place of PLACES) {
        for (let i = 0; i < 365 * 2; i++) {
          const day = new Date(2026, 0, 1, 12);
          day.setDate(day.getDate() + i);
          const byKey = new Map<string, Date>(
            computeZmanim(place, day).map((zman) => [zman.key, zman.date]),
          );
          const tag = label(place, day);
          const sunrise = byKey.get("sunrise")!;
          const sunset = byKey.get("sunset")!;

          // 'Hatsot est à mi-chemin exact du lever et du coucher, et non au midi
          // solaire : les deux diffèrent d'une demi-minute selon la saison.
          const chatzot = byKey.get("chatzot")!;
          if (Math.abs(minutes(sunrise, chatzot) - minutes(chatzot, sunset)) > 0.05) {
            anomalies.push(`${tag} : hatsot n'est pas au milieu du jour`);
          }
          // La sortie des étoiles suit la chkia, sans jamais s'en éloigner de
          // plus de deux heures, même au plus long des étés parisiens.
          const afterSunset = minutes(sunset, byKey.get("tzeit")!);
          if (afterSunset <= 0 || afterSunset > 150) {
            anomalies.push(
              `${tag} : sortie des étoiles à ${afterSunset.toFixed(0)} min de la chkia`,
            );
          }
          // Le jour du Maguen Avraham est plus large : ses limites tombent avant
          // celles du Gaon de Vilna, jamais après.
          const shemaMGA = byKey.get("sofZmanShmaMGA");
          if (shemaMGA && shemaMGA.getTime() >= byKey.get("sofZmanShma")!.getTime()) {
            anomalies.push(`${tag} : la fin du Chéma du Maguen Avraham passe après celle du Gaon`);
          }
          // Le milieu de la nuit qui suit tombe bien dans cette nuit-là.
          const chatzotNight = byKey.get("chatzotNight");
          if (chatzotNight) {
            const gap = minutes(sunset, chatzotNight) / 60;
            if (gap < 3 || gap > 10) {
              anomalies.push(`${tag} : hatsot de la nuit à ${gap.toFixed(1)} h de la chkia`);
            }
          }
        }
      }
      expect(anomalies.slice(0, 20)).toEqual([]);
    },
    SWEEP_TIMEOUT,
  );
});

describe("les 243 villes du catalogue", () => {
  type City = { name: string; country: string; lat: number; lon: number; tz: string };
  const CITIES = citiesJson as City[];

  /**
   * Les jours de l'année qui éprouvent le calcul : un par mois, et les quatre
   * tournants. Ces villes sont là pour leur latitude et leur fuseau, non pour
   * la finesse des dates, que le balayage jour après jour ci-dessus couvre.
   */
  const PROBE_DAYS: Date[] = [];
  for (let month = 0; month < 12; month++) PROBE_DAYS.push(new Date(2026, month, 1, 12));
  for (const [month, date] of [
    [2, 20],
    [5, 21],
    [8, 22],
    [11, 21],
  ]) {
    PROBE_DAYS.push(new Date(2026, month, date, 12));
  }

  it(
    "rendent toutes des horaires dans l'ordre, sans trou ni inversion",
    () => {
      const anomalies: string[] = [];
      for (const city of CITIES) {
        const place: ZmanimPlace = {
          source: "city",
          latitude: city.lat,
          longitude: city.lon,
          tzid: city.tz,
          city: city.name,
        };
        for (const day of PROBE_DAYS) {
          const times = computeZmanim(place, day);
          const byKey = new Map<string, Date>(times.map((zman) => [zman.key, zman.date]));
          const tag = `${city.name} (${city.country}, ${city.lat.toFixed(1)}°) ${day.toISOString().slice(0, 10)}`;

          // Jamais un horaire plus tôt que celui qui le précède dans la liste.
          // L'égalité stricte, elle, arrive vraiment : à Leeds le 9 janvier 2026,
          // la fin de la Amida du Maguen Avraham et la fin du Chéma du Gaon de
          // Vilna tombent à la même seconde.
          for (let k = 1; k < times.length; k++) {
            if (times[k].date.getTime() < times[k - 1].date.getTime()) {
              anomalies.push(`${tag} : ${times[k - 1].key} tombe après ${times[k].key}`);
            }
          }
          // Le lever, la chkia et hatsot existent partout dans le catalogue :
          // aucune de ses villes n'atteint le cercle polaire.
          const sunrise = byKey.get("sunrise");
          const sunset = byKey.get("sunset");
          const chatzot = byKey.get("chatzot");
          if (!sunrise || !sunset || !chatzot) {
            anomalies.push(`${tag} : lever, chkia ou hatsot manquant`);
            continue;
          }
          if (Math.abs(minutes(sunrise, chatzot) - minutes(chatzot, sunset)) > 0.05) {
            anomalies.push(`${tag} : hatsot n'est pas au milieu du jour`);
          }
          const shemaMGA = byKey.get("sofZmanShmaMGA");
          if (shemaMGA && shemaMGA.getTime() >= byKey.get("sofZmanShma")!.getTime()) {
            anomalies.push(`${tag} : le Chéma du Maguen Avraham passe après celui du Gaon`);
          }
          // La sortie des étoiles suit la chkia, et la borne est ici bien plus
          // large que sous nos latitudes : à Oslo, fin mai, le crépuscule dure
          // vraiment près de trois heures, et c'est la plus longue du catalogue.
          const tzeit = byKey.get("tzeit");
          if (tzeit && (minutes(sunset, tzeit) <= 0 || minutes(sunset, tzeit) > 240)) {
            anomalies.push(`${tag} : sortie des étoiles hors de portée de la chkia`);
          }
        }
      }
      expect(anomalies.slice(0, 20)).toEqual([]);
    },
    SWEEP_TIMEOUT,
  );

  it(
    "sont calculées au niveau de la mer, quelle que soit leur altitude",
    () => {
      // Le choix est posé dans `geoLocationOf` : altitude zéro, et le drapeau
      // d'élévation de hebcal à faux. C'est le mishor, la plaine, que retiennent
      // les luhot, et le catalogue ne porte d'ailleurs aucune altitude : aucune
      // ville n'y échappe, pas même une position relevée par l'appareil.
      //
      // Ce test tient ce choix et écrit noir sur blanc ce qu'il coûte, pour que
      // personne n'ait à le redécouvrir : Jérusalem est à 754 mètres, et compter
      // son altitude reculerait sa chkia de quatre minutes.
      const jerusalem: ZmanimPlace = {
        source: "city",
        latitude: 31.7683,
        longitude: 35.2137,
        tzid: "Asia/Jerusalem",
        city: "Jérusalem",
      };
      const day = new Date(2026, 8, 17, 12);
      const byKey = new Map<string, Date>(
        computeZmanim(jerusalem, day).map((zman) => [zman.key, zman.date]),
      );
      const atSeaLevel = new Zmanim(
        new GeoLocation("Jérusalem", 31.7683, 35.2137, 0, "Asia/Jerusalem"),
        day,
        false,
      );
      expect(byKey.get("sunrise")!.getTime()).toBe(atSeaLevel.sunrise().getTime());
      expect(byKey.get("sunset")!.getTime()).toBe(atSeaLevel.sunset().getTime());

      const at754m = new Zmanim(
        new GeoLocation("Jérusalem", 31.7683, 35.2137, 754, "Asia/Jerusalem"),
        day,
        true,
      );
      const later = minutes(atSeaLevel.sunset(), at754m.sunset());
      expect(later).toBeGreaterThan(3);
      expect(later).toBeLessThan(6);
      // Les horaires comptés en degrés, eux, ne bougent pas d'une seconde avec
      // l'altitude : ils mesurent la lumière du ciel, pas la ligne d'horizon.
      expect(at754m.tzeit(8.5).getTime()).toBe(atSeaLevel.tzeit(8.5).getTime());
    },
    SWEEP_TIMEOUT,
  );
});

describe("les villes du Nord, où l'avis par degrés s'arrête", () => {
  /**
   * Au nord de Lille, le soleil ne descend plus à 16,1° au cœur de l'été, et
   * plus à 8,5° à partir de Stockholm : l'avis du Rav Posen n'a alors pas
   * d'heure à donner. L'application ne lui en invente pas, mais elle ne laisse
   * pas non plus la ligne manquer en silence, et surtout elle ne fait plus
   * disparaître ce qui tient encore debout : le 17 Tamouz garde sa fin quand
   * son aube n'existe pas, le Chabbat garde son allumage quand sa sortie
   * n'existe pas.
   */
  const NORTH: ZmanimPlace[] = [
    { source: "city", latitude: 50.6292, longitude: 3.0573, tzid: "Europe/Paris", city: "Lille" },
    {
      source: "city",
      latitude: 51.5074,
      longitude: -0.1278,
      tzid: "Europe/London",
      city: "Londres",
    },
    {
      source: "city",
      latitude: 54.9626,
      longitude: -1.6,
      tzid: "Europe/London",
      city: "Gateshead",
    },
    {
      source: "city",
      latitude: 60.1695,
      longitude: 24.9354,
      tzid: "Europe/Helsinki",
      city: "Helsinki",
    },
  ];

  it(
    "gardent leurs six jeûnes et tous leurs Chabbats",
    () => {
      const anomalies: string[] = [];
      for (const place of NORTH) {
        for (const year of [5787, 5788]) {
          const yearStart = new HDate(1, months.TISHREI, year).abs();
          const yearEnd = new HDate(1, months.TISHREI, year + 1).abs();
          let fasts = 0;
          for (let abs = yearStart; abs < yearEnd; abs++) {
            const hd = new HDate(abs);
            if (fastAt(place, hd, "fr")) fasts++;
            if (hd.getDay() !== 6) continue;
            const period = restPeriodAt(place, hd, "fr");
            if (!period) {
              anomalies.push(`${place.city} : Chabbat ${hd.toString()} sans bloc`);
              continue;
            }
            // L'allumage se lit sur la chkia : il existe partout ici, même
            // quand la sortie des étoiles, elle, n'existe pas.
            if (!period.start) anomalies.push(`${place.city} ${hd.toString()} : sans allumage`);
          }
          if (fasts !== 6) {
            anomalies.push(`${place.city} ${year} : ${fasts} jeûnes au lieu de six`);
          }
        }
      }
      expect(anomalies.slice(0, 20)).toEqual([]);
    },
    SWEEP_TIMEOUT,
  );

  it(
    "expliquent chaque horaire absent, sans jamais le confondre avec la nuit polaire",
    () => {
      const anomalies: string[] = [];
      for (const place of NORTH) {
        let explained = 0;
        for (let i = 0; i < 365; i++) {
          const day = new Date(2026, 0, 1, 12);
          day.setDate(day.getDate() + i);
          const gap = zmanimGap(place, day);
          const times = computeZmanim(place, day);
          const tag = `${place.city} ${day.toISOString().slice(0, 10)}`;

          // Un horaire absent, et une note pour le dire : jamais l'un sans
          // l'autre. `chatzotNightDawn` reste hors du compte : il manque par
          // construction certains jours, sans que le soleil y soit pour rien.
          const present = new Set<string>(times.map((zman) => zman.key));
          const missing = ZMAN_KEYS.some((key) => key !== "chatzotNightDawn" && !present.has(key));
          if (missing !== (gap !== null)) {
            anomalies.push(
              `${tag} : ${missing ? "horaire absent sans note" : "note sans absence"}`,
            );
          }
          if (!gap) continue;
          explained++;
          // Aucune de ces villes n'atteint le cercle polaire : le soleil s'y
          // lève et s'y couche tous les jours, la note est donc toujours celle
          // du calcul par degrés, jamais celle du jour ou de la nuit polaire.
          if (gap.reason !== "degrees")
            anomalies.push(`${tag} : note « ${gap.reason} » inattendue`);
          // Quand l'aube manque, les deux limites du Maguen Avraham manquent
          // avec elle : elles se comptent depuis elle. L'inverse n'est pas vrai,
          // et c'est normal : le jour du Maguen Avraham a besoin des 16,1° du
          // MATIN et de ceux du SOIR, et il y a chaque année un jour ou deux où
          // le premier existe encore quand le second n'existe déjà plus.
          if (gap.keys.includes("alotHaShachar") && !gap.keys.includes("sofZmanShmaMGA")) {
            anomalies.push(`${tag} : l'aube manque sans que le Maguen Avraham manque`);
          }
          // Et ses deux limites vont toujours ensemble.
          if (gap.keys.includes("sofZmanShmaMGA") !== gap.keys.includes("sofZmanTfillaMGA")) {
            anomalies.push(`${tag} : une seule des deux limites du Maguen Avraham manque`);
          }
        }
        // Lille en compte une quinzaine par an, Helsinki plus d'une centaine :
        // une ville du Nord sans aucun jour expliqué trahirait un calcul muet.
        if (explained === 0) anomalies.push(`${place.city} : aucun jour expliqué dans l'année`);
      }
      expect(anomalies.slice(0, 20)).toEqual([]);
    },
    SWEEP_TIMEOUT,
  );
});

describe("les blocs de repos et les jeûnes, année après année", () => {
  /** Paris pour le public, Jérusalem pour le calendrier d'Israël, New York pour le fuseau. */
  const YEARS = [5786, 5787, 5788, 5789, 5790];

  it(
    "entrent la veille au soir et sortent le dernier soir",
    () => {
      const anomalies: string[] = [];
      for (const place of PLACES.slice(0, 4)) {
        const il = place.tzid === "Asia/Jerusalem";
        for (const year of YEARS) {
          const yearStart = new HDate(1, months.TISHREI, year).abs();
          const yearEnd = new HDate(1, months.TISHREI, year + 1).abs();
          const covered = new Set<number>();
          let abs = yearStart;
          while (abs < yearEnd) {
            const period = restPeriodAt(place, new HDate(abs), "fr");
            if (!period) {
              abs++;
              continue;
            }
            const tag = `${place.city} ${period.first.toString()}`;
            const days = period.last.abs() - period.first.abs() + 1;

            // Trois jours au plus : un Yom Tov de deux jours prolongé d'un Chabbat.
            if (days < 1 || days > 3) anomalies.push(`${tag} : bloc de ${days} jours`);
            if (period.end && period.start.getTime() >= period.end.getTime()) {
              anomalies.push(`${tag} : entrée après la sortie`);
            }
            // L'allumage se lit sur la chkia de la VEILLE du premier jour. hebcal
            // l'arrondit à la minute entière, toujours vers le tôt : l'écart va
            // donc de N à N+1 minutes, jamais moins de N.
            const eve = civilNoon(period.first);
            eve.setDate(eve.getDate() - 1);
            const wanted = candleLightingMinutes(place);
            const gap = minutes(period.start, getSunset(place, eve)!);
            if (gap < wanted || gap >= wanted + 1) {
              anomalies.push(
                `${tag} : allumage à ${gap.toFixed(1)} min de la chkia (${wanted} attendu)`,
              );
            }
            // Et la sortie sur la chkia du DERNIER jour, jamais avant elle. Elle
            // peut manquer aux latitudes où le soleil ne descend pas à 8,5° en
            // été (voir RestPeriod.end) : le bloc est alors annoncé avec son
            // seul allumage, ce que la ligne suivante vérifie aussi.
            if (period.end) {
              const after = minutes(getSunset(place, civilNoon(period.last))!, period.end);
              if (after <= 0 || after > 240) {
                anomalies.push(
                  `${tag} : sortie à ${after.toFixed(0)} min de la chkia du dernier jour`,
                );
              }
            }
            // Rabbénou Tam ne se donne qu'avec une sortie ordinaire, et après
            // elle : seul au milieu d'un cadre sans sortie, il n'apprendrait rien.
            if (period.endRabbenouTam && !period.end) {
              anomalies.push(`${tag} : Rabbénou Tam sans sortie ordinaire`);
            }
            if (
              period.endRabbenouTam &&
              period.end &&
              period.endRabbenouTam.getTime() <= period.end.getTime()
            ) {
              anomalies.push(`${tag} : Rabbénou Tam avant la sortie`);
            }
            // Les deux bornes sont bien des jours où le travail est interdit.
            for (const bound of [period.first, period.last]) {
              const chag = (getHolidaysOnDate(bound, il) ?? []).some(
                (ev) => (ev.getFlags() & flags.CHAG) !== 0,
              );
              if (bound.getDay() !== 6 && !chag) {
                anomalies.push(`${tag} : ${bound.toString()} n'est pas un jour de repos`);
              }
            }
            for (let a = period.first.abs(); a <= period.last.abs(); a++) covered.add(a);
            abs = period.last.abs() + 1;
          }
          // Aucun Chabbat de l'année ne reste sans bloc.
          for (let a = yearStart; a < yearEnd; a++) {
            const hd = new HDate(a);
            if (hd.getDay() === 6 && !covered.has(a)) {
              anomalies.push(`${place.city} : Chabbat ${hd.toString()} sans bloc`);
            }
          }
        }
      }
      expect(anomalies.slice(0, 20)).toEqual([]);
    },
    SWEEP_TIMEOUT,
  );

  it(
    "donnent six jeûnes par an, jamais un Chabbat, jamais de durée absurde",
    () => {
      const anomalies: string[] = [];
      for (const place of PLACES.slice(0, 4)) {
        for (const year of YEARS) {
          const yearStart = new HDate(1, months.TISHREI, year).abs();
          const yearEnd = new HDate(1, months.TISHREI, year + 1).abs();
          let count = 0;
          for (let abs = yearStart; abs < yearEnd; abs++) {
            const hd = new HDate(abs);
            const fast = fastAt(place, hd, "fr");
            if (!fast) continue;
            count++;
            const tag = `${place.city} ${fast.name} ${hd.toString()}`;
            // Un jeûne public ne tombe jamais un Chabbat : hebcal rend déjà le
            // jour OBSERVÉ, reporté au dimanche (ou au jeudi pour les premiers-nés).
            if (hd.getDay() === 6) anomalies.push(`${tag} : tombe un Chabbat`);
            // Un jeûne sans heure de début n'arrive qu'aux latitudes où l'aube
            // de l'avis par degrés n'existe pas, et jamais pour Tich'a beAv,
            // qui part de la chkia de la veille (voir FastPeriod.start).
            if (!fast.start) {
              if (fast.fromEve) anomalies.push(`${tag} : Tich'a beAv sans heure de début`);
              continue;
            }
            if (fast.start.getTime() >= fast.end.getTime()) {
              anomalies.push(`${tag} : commence après sa fin`);
            }
            // Tich'a beAv dure de soir à soir ; les petits jeûnes, de l'aube à
            // la nuit, ce qui va d'une dizaine d'heures l'hiver à vingt l'été.
            const hours = minutes(fast.start, fast.end) / 60;
            const plausible = fast.fromEve ? hours > 23 && hours < 27 : hours > 9 && hours < 21;
            if (!plausible) anomalies.push(`${tag} : dure ${hours.toFixed(1)} h`);
          }
          if (count !== 6) anomalies.push(`${place.city} ${year} : ${count} jeûnes au lieu de six`);
        }
      }
      expect(anomalies.slice(0, 20)).toEqual([]);
    },
    SWEEP_TIMEOUT,
  );
});
