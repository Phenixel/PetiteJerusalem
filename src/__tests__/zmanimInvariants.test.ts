import { describe, expect, it } from "vitest";
import { flags, getHolidaysOnDate, HDate, months } from "@hebcal/core";
import {
  candleLightingMinutes,
  computeZmanim,
  fastAt,
  getSunset,
  restPeriodAt,
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
 * Les villes sont choisies pour ce qu'elles mettent à l'épreuve : Paris et
 * Marseille pour le public de l'application, Jérusalem pour le calendrier
 * d'Israël (Yom Tov d'un seul jour), New York pour un fuseau dont la chkia
 * tombe après minuit UTC, Buenos Aires pour l'hémisphère sud, où les saisons
 * s'inversent.
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

describe("les horaires du jour, tout au long de l'année", () => {
  it("se suivent dans l'ordre, partout et en toute saison", () => {
    const anomalies: string[] = [];
    for (const place of PLACES) {
      for (let i = 0; i < 365 * 3; i++) {
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
  });

  it("tiennent les rapports qui définissent chaque zman", () => {
    const anomalies: string[] = [];
    for (const place of PLACES) {
      for (let i = 0; i < 365 * 3; i++) {
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
          anomalies.push(`${tag} : sortie des étoiles à ${afterSunset.toFixed(0)} min de la chkia`);
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
  });
});

describe("les blocs de repos et les jeûnes, année après année", () => {
  /** Paris pour le public, Jérusalem pour le calendrier d'Israël, New York pour le fuseau. */
  const YEARS = [5786, 5787, 5788, 5789, 5790];

  it("entrent la veille au soir et sortent le dernier soir", () => {
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
          if (period.start.getTime() >= period.end.getTime()) {
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
          // Et la sortie sur la chkia du DERNIER jour, jamais avant elle.
          const after = minutes(getSunset(place, civilNoon(period.last))!, period.end);
          if (after <= 0 || after > 150) {
            anomalies.push(`${tag} : sortie à ${after.toFixed(0)} min de la chkia du dernier jour`);
          }
          // Rabbénou Tam, quand il est donné, vient après la sortie ordinaire.
          if (period.endRabbenouTam && period.endRabbenouTam.getTime() <= period.end.getTime()) {
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
  });

  it("donnent six jeûnes par an, jamais un Chabbat, jamais de durée absurde", () => {
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
  });
});
