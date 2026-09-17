import { afterEach, describe, expect, it } from "vitest";
import { HDate, HebrewCalendar, Location, TimedEvent, flags } from "@hebcal/core";
import {
  DEFAULT_PLACE,
  restPeriodAt,
  setZmanimOpinion,
  type RestLighting,
} from "../services/zmanimService";
import { DEFAULT_ZMANIM_OPINION } from "../services/zmanimOpinions";

/**
 * Les allumages À L'INTÉRIEUR d'un bloc de repos, et l'érouv tavchilin (voir
 * l'audit, manques 4.1 et 4.2).
 *
 * Un bloc n'avait qu'une entrée et qu'une sortie. Mais entre les deux il y a
 * des soirs, et chacun demande une heure : le deuxième soir d'un Yom Tov, le
 * vendredi pris dans une fête, le Yom Tov qui commence à la sortie du
 * Chabbat. La note disait « on allume après la sortie, à partir d'une flamme
 * déjà allumée », sans jamais donner l'heure.
 *
 * Les heures attendues sont celles de hebcal lui-même, par un autre chemin :
 * les événements d'allumage que `HebrewCalendar.calendar` publie avec les
 * mêmes paramètres (18 minutes, havdala à 8,5°). Le dernier test le vérifie
 * sur une année entière.
 */

const place = DEFAULT_PLACE;
const clock = (date: Date) =>
  date.toLocaleTimeString("fr-FR", { timeZone: place.tzid, hour: "2-digit", minute: "2-digit" });
const day = (date: Date) =>
  date.toLocaleDateString("fr-CA", { timeZone: place.tzid, dateStyle: "short" });

/** Le bloc de repos auquel appartient ce jour civil. */
const blockOn = (y: number, m: number, d: number) =>
  restPeriodAt(place, new HDate(new Date(y, m - 1, d, 12)), "fr")!;

const describeLighting = (lighting: RestLighting) => ({
  jour: day(lighting.at),
  heure: clock(lighting.at),
  regle: lighting.rule,
});

afterEach(() => setZmanimOpinion(DEFAULT_ZMANIM_OPINION));

describe("les allumages d'un bloc de repos", () => {
  it("n'en ajoute aucun à un Chabbat ordinaire", () => {
    // Un Chabbat seul n'a qu'un soir : celui de son entrée, qui est `start`.
    const shabbat = blockOn(2026, 8, 8);
    expect(shabbat.lightings).toEqual([]);
    expect(shabbat.eruvTavshilin).toBeNull();
  });

  it("donne l'allumage du deuxième soir, après la sortie du Chabbat", () => {
    // Roch Hachana 5787 : Chabbat le 12 septembre 2026, premier jour de fête
    // le même jour, second le dimanche 13. Le soir du samedi ouvre le
    // deuxième jour : on allume à la sortie du Chabbat, 20:58 (hebcal :
    // « Candle lighting: 8:58pm » le 12 septembre).
    const rosh = blockOn(2026, 9, 12);
    expect(rosh.lightings.map(describeLighting)).toEqual([
      { jour: "2026-09-12", heure: "20:58", regle: "afterShabbat" },
    ]);
    // L'entrée reste le vendredi soir, la sortie le dimanche.
    expect(day(rosh.start)).toBe("2026-09-11");
    expect(day(rosh.end!)).toBe("2026-09-13");
  });

  it("donne les deux allumages d'un Pessah de jeudi à samedi", () => {
    // Pessah 5787 : jeudi 22, vendredi 23, Chabbat 24 avril 2027. Le soir du
    // jeudi ouvre le deuxième jour de fête, à la nuit ; celui du vendredi
    // ouvre le Chabbat, avant la chkia.
    const pessah = blockOn(2027, 4, 22);
    expect(pessah.lightings.map(describeLighting)).toEqual([
      { jour: "2027-04-22", heure: "21:44", regle: "afterNightfall" },
      { jour: "2027-04-23", heure: "20:35", regle: "beforeSunset" },
    ]);
  });

  it("donne l'allumage d'un Yom Tov qui commence à la sortie du Chabbat", () => {
    // Chavou'ot 5789 : Chabbat le 19 mai 2029, la fête les 20 et 21. Le soir
    // du Chabbat ouvre le premier jour, celui du dimanche le second.
    // hebcal donne 22:31 et 22:32 ; le second s'affiche ici 22:33, parce
    // qu'un allumage de nuit est un DÉBUT et monte à la minute supérieure
    // (voir ZmanRounding), là où hebcal coupe vers le bas.
    const chavouot = blockOn(2029, 5, 20);
    expect(chavouot.lightings.map(describeLighting)).toEqual([
      { jour: "2029-05-19", heure: "22:31", regle: "afterShabbat" },
      { jour: "2029-05-20", heure: "22:33", regle: "afterNightfall" },
    ]);
  });

  it("nomme le jour hébraïque que chaque allumage ouvre", () => {
    // L'allumage n'appartient pas au jour qui s'achève mais à celui qui
    // commence : c'est ce jour-là que la ligne du cadre doit nommer.
    const pessah = blockOn(2027, 4, 22);
    expect(pessah.lightings[0].day.getDate()).toBe(16); // 16 Nissan
    expect(pessah.lightings[1].day.getDay()).toBe(6); // le Chabbat
  });
});

describe("l'érouv tavchilin", () => {
  it("le demande quand un Yom Tov tombe le vendredi et que le Chabbat suit", () => {
    // Pessah 5787 : la fête est jeudi et vendredi, le Chabbat suit. L'érouv
    // se pose la veille du premier jour, le mercredi 21 avril 2027.
    const pessah = blockOn(2027, 4, 22);
    expect(day(pessah.eruvTavshilin!)).toBe("2027-04-21");
  });

  it("ne le demande pas quand la fête ne touche pas le vendredi", () => {
    // Roch Hachana 5787 : samedi et dimanche. Rien à préparer.
    expect(blockOn(2026, 9, 12).eruvTavshilin).toBeNull();
    // Chavou'ot 5789 : dimanche et lundi, après le Chabbat.
    expect(blockOn(2029, 5, 20).eruvTavshilin).toBeNull();
  });
});

describe("recoupement avec hebcal, sur une année entière", () => {
  /**
   * hebcal publie ses propres moments d'allumage et de sortie, par un tout
   * autre chemin que `restPeriodAt`. Avec les mêmes paramètres, les deux
   * doivent tomber à la minute : c'est ce qui tient les trois règles
   * ensemble, et non trois dates choisies à la main.
   *
   * Une minute de tolérance, et pas moins : nos fins montent à la minute
   * supérieure quand hebcal coupe vers le bas (voir ZmanRounding). Au-delà,
   * c'est une règle qui manque, pas un arrondi.
   */
  it("retrouve chaque allumage et chaque sortie de hebcal dans un bloc", () => {
    const location = new Location(
      place.latitude,
      place.longitude,
      false,
      place.tzid,
      "Paris",
      "FR",
    );
    const events = HebrewCalendar.calendar({
      start: new Date(2026, 8, 1),
      end: new Date(2027, 8, 1),
      location,
      candlelighting: true,
      candleLightingMins: 18,
      havdalahDeg: 8.5,
      il: false,
    });

    // Tous les moments que nos blocs connaissent : entrée, allumages, sortie.
    const ours: number[] = [];
    const seen = new Set<number>();
    for (const event of events) {
      const hd = event.getDate();
      if (seen.has(hd.abs())) continue;
      const period = restPeriodAt(place, hd, "fr");
      if (!period) continue;
      for (let d = period.first; d.abs() <= period.last.abs(); d = d.next()) seen.add(d.abs());
      ours.push(period.start.getTime());
      for (const lighting of period.lightings) ours.push(lighting.at.getTime());
      if (period.end) ours.push(period.end.getTime());
    }

    const TOLERANCE = 60_000;
    const missing: string[] = [];
    for (const event of events) {
      const fl = event.getFlags();
      const timed =
        (fl & (flags.LIGHT_CANDLES | flags.LIGHT_CANDLES_TZEIS | flags.YOM_TOV_ENDS)) !== 0;
      // Seuls les événements HORODATÉS portent une heure : les autres nomment
      // le jour de fête, sans instant à comparer.
      if (!timed || !(event instanceof TimedEvent)) continue;
      const when = event.eventTime.getTime();
      const closest = Math.min(...ours.map((mine) => Math.abs(mine - when)));
      if (closest > TOLERANCE) {
        missing.push(`${day(event.eventTime)} ${clock(event.eventTime)} (${event.getDesc()})`);
      }
    }
    expect(missing).toEqual([]);
  });
});
