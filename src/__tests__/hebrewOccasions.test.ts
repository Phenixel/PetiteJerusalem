import { describe, expect, it } from "vitest";
import { HDate, months } from "@hebcal/core";
import {
  nextOccurrence,
  occasionDateIn,
  parseOccasion,
  type HebrewOccasion,
} from "../services/hebrewOccasions";
import { OCCASION_REMINDER_HOUR, planZmanReminders } from "../services/zmanReminderService";
import { DEFAULT_PLACE, getSunset } from "../services/zmanimService";

/**
 * Les dates personnelles du calendrier reviennent chaque année à leur jour
 * hébraïque, ce qui n'a rien d'une addition : deux particularités du
 * calendrier demandent une décision (voir hebrewOccasions), et ce sont elles
 * que ces tests tiennent.
 *
 * Repères : 5786 est une année ordinaire (douze mois), 5787 en compte treize.
 */

const occasion = (over: Partial<HebrewOccasion> = {}): HebrewOccasion => ({
  id: "test",
  name: "Papy Élie",
  kind: "yahrzeit",
  day: 12,
  month: months.KISLEV,
  reminder: "none",
  ...over,
});

describe("occasionDateIn", () => {
  it("place la date à son jour dans l'année demandée", () => {
    const date = occasionDateIn(occasion(), 5787);

    expect(date.getDate()).toBe(12);
    expect(date.getMonth()).toBe(months.KISLEV);
    expect(date.getFullYear()).toBe(5787);
  });

  it("reporte une date d'Adar en Adar II les années à treize mois", () => {
    const purim = occasion({ day: 14, month: months.ADAR_I });

    expect(HDate.isLeapYear(5786)).toBe(false);
    expect(occasionDateIn(purim, 5786).getMonth()).toBe(months.ADAR_I);
    // 5787 a deux Adar : l'usage séfarade, suivi partout sur le site, retient
    // le second.
    expect(HDate.isLeapYear(5787)).toBe(true);
    expect(occasionDateIn(purim, 5787).getMonth()).toBe(months.ADAR_II);
  });

  it("ramène le 30 au dernier jour d'un mois qui n'en compte que 29", () => {
    const date = occasion({ day: 30, month: months.CHESHVAN });

    // 'Hechvan a 30 jours en 5787, 29 en 5786.
    expect(occasionDateIn(date, 5787).getDate()).toBe(30);
    expect(occasionDateIn(date, 5786).getDate()).toBe(29);
  });
});

describe("nextOccurrence", () => {
  it("rend celle de cette année quand elle n'est pas passée", () => {
    const today = new HDate(1, months.KISLEV, 5787);
    const next = nextOccurrence(occasion(), today);

    expect(next.getFullYear()).toBe(5787);
    expect(next.getDate()).toBe(12);
  });

  it("passe à l'an prochain quand le jour est derrière", () => {
    const today = new HDate(13, months.KISLEV, 5787);

    expect(nextOccurrence(occasion(), today).getFullYear()).toBe(5788);
  });

  it("compte le jour même comme à venir", () => {
    const today = new HDate(12, months.KISLEV, 5787);

    expect(nextOccurrence(occasion(), today).getFullYear()).toBe(5787);
  });
});

describe("parseOccasion", () => {
  it("refuse ce qui n'a plus rien d'une date", () => {
    expect(parseOccasion(null)).toBeNull();
    expect(parseOccasion({ name: "", day: 1, month: months.AV })).toBeNull();
    expect(parseOccasion({ name: "X", day: 31, month: months.AV })).toBeNull();
    expect(parseOccasion({ name: "X", day: 1, month: 99 })).toBeNull();
  });

  it("complète ce qui manque plutôt que de perdre la date", () => {
    const parsed = parseOccasion({ name: "  Papy Élie  ", day: 3, month: months.AV });

    expect(parsed).toMatchObject({ name: "Papy Élie", kind: "other", reminder: "none" });
    expect(parsed?.id).toBeTruthy();
  });
});

describe("rappels des dates personnelles", () => {
  /** Mardi 4 août 2026, 5 h à Paris. */
  const NOW = new Date(Date.UTC(2026, 7, 4, 3));

  const plan = (occasions: HebrewOccasion[]) =>
    planZmanReminders({
      place: DEFAULT_PLACE,
      reminders: [],
      rest: false,
      occasions,
      locale: "fr",
      now: NOW,
    });

  it("ne programme rien pour une date sans rappel", () => {
    expect(plan([occasion()])).toEqual([]);
  });

  it("part au coucher du soleil de la veille pour l'entrée du jour", () => {
    const [reminder] = plan([occasion({ reminder: "nightfall" })]);
    const eve = new Date(reminder.target);
    eve.setDate(eve.getDate() - 1);

    // Le jour hébraïque commence la veille au soir : c'est là qu'on allume.
    expect(reminder.at.getTime()).toBe(getSunset(DEFAULT_PLACE, eve)!.getTime());
    expect(reminder.occasion?.name).toBe("Papy Élie");
  });

  it("part le matin du jour même quand c'est ce qui est demandé", () => {
    const [reminder] = plan([occasion({ reminder: "morning" })]);

    expect(reminder.at.getHours()).toBe(OCCASION_REMINDER_HOUR);
    expect(reminder.at.toDateString()).toBe(reminder.target.toDateString());
  });

  it("part sept jours plus tôt pour un rappel d'une semaine", () => {
    const [reminder] = plan([occasion({ reminder: "weekBefore" })]);
    const gap = reminder.target.getTime() - reminder.at.getTime();

    expect(Math.round(gap / 86_400_000)).toBe(7);
  });

  it("saute l'année en cours quand le moment du rappel est passé", () => {
    // Le 12 Kislev 5787 tombe le 2 décembre 2026 : la veille au soir est déjà
    // derrière nous si l'on se place après. Un rappel « une semaine avant »
    // posé quatre jours avant la date doit viser l'année suivante.
    const late = new Date(Date.UTC(2026, 10, 30, 12));
    const [reminder] = planZmanReminders({
      place: DEFAULT_PLACE,
      reminders: [],
      rest: false,
      occasions: [occasion({ reminder: "weekBefore" })],
      locale: "fr",
      now: late,
    });

    expect(reminder.at.getTime()).toBeGreaterThan(late.getTime());
    expect(reminder.target.getFullYear()).toBe(2027);
  });

  it("donne un identifiant distinct à chaque date", () => {
    const planned = plan([
      occasion({ id: "a", reminder: "morning" }),
      occasion({ id: "b", day: 5, reminder: "morning" }),
    ]);

    expect(new Set(planned.map((reminder) => reminder.id)).size).toBe(2);
  });
});
