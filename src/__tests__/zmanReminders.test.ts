import { describe, expect, it } from "vitest";
import { HDate } from "@hebcal/core";
import {
  describeReminder,
  MAX_PENDING,
  planZmanReminders,
  type PlannedReminder,
} from "../services/zmanReminderService";
import { REST_REMINDER_MINUTES } from "../composables/useZmanReminders";
import {
  computeZmanim,
  DEFAULT_PLACE,
  dayInPlace,
  formatZmanTime,
  restPeriodAt,
  ZMAN_KEYS,
} from "../services/zmanimService";

/**
 * Les rappels d'horaires sont programmés à l'avance, un instant à la fois :
 * un horaire n'a pas d'heure fixe, une notification « tous les jours à 6 h 13 »
 * serait fausse dès le lendemain (voir zmanReminderService).
 *
 * Ces tests portent sur le plan, qui est une fonction pure : ce qui est
 * programmé, quand, et combien. Le passage au système (annuler, reprogrammer)
 * n'a rien à vérifier ici, il n'existe que sur un téléphone.
 *
 * Instants en UTC, comme zmanim.test.ts : les heures attendues sont celles de
 * Paris, données par le fuseau du lieu et non par celui de la machine.
 */

/** Mardi 4 août 2026, 5 h à Paris : avant le netz, après hatsot de la nuit. */
const MORNING = new Date(Date.UTC(2026, 7, 4, 3));
/** Le même jour à midi passé : le netz est derrière nous. */
const NOON = new Date(Date.UTC(2026, 7, 4, 12));

const clock = (date: Date) => formatZmanTime(date, DEFAULT_PLACE.tzid, "fr");

/** L'horaire d'un jour donné, tel que la page l'affiche. */
function zmanOn(key: (typeof ZMAN_KEYS)[number], day: Date): Date {
  const zman = computeZmanim(DEFAULT_PLACE, day).find((time) => time.key === key);
  if (!zman) throw new Error(`horaire ${key} introuvable`);
  return zman.date;
}

const plan = (options: Partial<Parameters<typeof planZmanReminders>[0]> = {}) =>
  planZmanReminders({
    place: DEFAULT_PLACE,
    reminders: [],
    rest: false,
    locale: "fr",
    now: MORNING,
    ...options,
  });

describe("planZmanReminders", () => {
  it("ne programme rien sans rappel posé", () => {
    expect(plan()).toEqual([]);
  });

  it("annonce l'horaire du jour, le délai demandé à l'avance", () => {
    const [first] = plan({ reminders: [{ key: "sunrise", minutesBefore: 15 }] });

    expect(clock(zmanOn("sunrise", MORNING))).toBe("06:27");
    expect(clock(first.target)).toBe("06:27");
    expect(clock(first.at)).toBe("06:12");
    expect(first.zman).toBe("sunrise");
    expect(first.minutesBefore).toBe(15);
  });

  it("recalcule chaque jour plutôt que de répéter une heure fixe", () => {
    const planned = plan({ reminders: [{ key: "sunrise", minutesBefore: 0 }] });
    const heures = planned.map((reminder) => clock(reminder.at));

    // Le netz recule de quelques minutes par jour en août : deux jours de
    // suite ne peuvent pas porter la même heure.
    expect(new Set(heures).size).toBe(heures.length);
    for (const [index, reminder] of planned.entries()) {
      const day = new Date(MORNING.getTime() + index * 86_400_000);
      expect(reminder.at.getTime()).toBe(zmanOn("sunrise", day).getTime());
    }
  });

  it("saute l'horaire du jour déjà passé", () => {
    const [first] = plan({ now: NOON, reminders: [{ key: "sunrise", minutesBefore: 15 }] });

    // À midi, le netz du jour est derrière : le premier rappel est celui de
    // demain, pas un instant dans le passé que le système ferait sonner tout
    // de suite.
    expect(first.at.getTime()).toBeGreaterThan(NOON.getTime());
    expect(dayInPlace(DEFAULT_PLACE, first.target).getDate()).toBe(5);
  });

  it("part de l'instant le plus proche et reste dans l'ordre", () => {
    const planned = plan({
      reminders: [
        { key: "sunset", minutesBefore: 30 },
        { key: "sunrise", minutesBefore: 0 },
      ],
      rest: true,
    });

    const times = planned.map((reminder) => reminder.at.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(planned[0].zman).toBe("sunrise");
  });

  it("donne à chaque rappel un identifiant stable et distinct", () => {
    const reminders = [
      { key: "sunrise" as const, minutesBefore: 10 },
      { key: "sunset" as const, minutesBefore: 10 },
    ];
    const first = plan({ reminders });
    const second = plan({ reminders });

    const ids = first.map((reminder) => reminder.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(second.map((reminder) => reminder.id)).toEqual(ids);
  });

  it("tient dans ce que le système garde en attente", () => {
    // Tous les horaires rappelés d'un coup : la fenêtre se raccourcit d'autant.
    const reminders = ZMAN_KEYS.map((key) => ({ key, minutesBefore: 5 }));
    const planned = plan({ reminders, rest: true });

    expect(planned.length).toBeLessThanOrEqual(MAX_PENDING);
    // Et chaque horaire garde tout de même quelques jours d'avance.
    for (const key of ZMAN_KEYS) {
      const own = planned.filter((reminder) => reminder.zman === key);
      expect(own.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("garde une fenêtre plus large quand un seul horaire est rappelé", () => {
    const seul = plan({ reminders: [{ key: "sunrise", minutesBefore: 5 }] });
    const nombreux = plan({
      reminders: ZMAN_KEYS.map((key) => ({ key, minutesBefore: 5 })),
    }).filter((reminder) => reminder.zman === "sunrise");

    expect(seul.length).toBeGreaterThan(nombreux.length);
  });
});

describe("rappel de l'entrée du repos", () => {
  const restOf = (planned: PlannedReminder[]) => planned.filter((reminder) => !reminder.zman);

  it("part une heure avant l'allumage du Chabbat qui vient", () => {
    const [first] = restOf(plan({ rest: true }));
    // Vendredi 7 août 2026, l'allumage de ce Chabbat-là.
    const shabbat = restPeriodAt(DEFAULT_PLACE, new HDate(new Date(2026, 7, 8, 12)), "fr");

    expect(first.target.getTime()).toBe(shabbat!.start.getTime());
    expect(first.at.getTime()).toBe(shabbat!.start.getTime() - REST_REMINDER_MINUTES * 60_000);
    expect(first.shabbat).toBe(true);
  });

  it("nomme la fête quand le repos en est une", () => {
    // Roch Hachana 5787 : mardi 12 et mercredi 13 septembre 2026.
    const veille = new Date(Date.UTC(2026, 8, 10, 12));
    const [first] = restOf(plan({ rest: true, now: veille }));

    expect(first.festivals?.join(" ")).toContain("Roch Hachana");
  });

  it("ne rappelle pas un repos déjà entré", () => {
    // Vendredi 7 août 2026, 21 h à Paris : l'allumage (21 h 05) est passé.
    const apres = new Date(Date.UTC(2026, 7, 7, 19));
    for (const reminder of restOf(plan({ rest: true, now: apres }))) {
      expect(reminder.at.getTime()).toBeGreaterThan(apres.getTime());
    }
  });

  it("ne programme rien quand le rappel est coupé", () => {
    expect(
      restOf(plan({ rest: false, reminders: [{ key: "sunrise", minutesBefore: 5 }] })),
    ).toEqual([]);
  });
});

describe("describeReminder", () => {
  /** Un `t` de test : rend la clé et ses paramètres, pas la traduction. */
  const t = (key: string, params?: Record<string, unknown>) =>
    params ? `${key}(${Object.values(params).join(",")})` : key;

  it("annonce le nom de l'horaire et le temps qui reste", () => {
    const [first] = plan({ reminders: [{ key: "sunrise", minutesBefore: 15 }] });
    const { title, body } = describeReminder(first, DEFAULT_PLACE.tzid, "fr", t);

    expect(title).toBe("zmanim.names.sunrise");
    expect(body).toBe("zmanim.reminder.notifyBody(15,06:27)");
  });

  it("dit « c'est l'heure » quand le rappel est posé à l'heure pile", () => {
    const [first] = plan({ reminders: [{ key: "sunrise", minutesBefore: 0 }] });

    expect(describeReminder(first, DEFAULT_PLACE.tzid, "fr", t).body).toBe(
      "zmanim.reminder.notifyNow(06:27)",
    );
  });

  it("titre le rappel du repos du nom qu'il porte", () => {
    const [shabbat] = plan({ rest: true }).filter((reminder) => !reminder.zman);
    expect(describeReminder(shabbat, DEFAULT_PLACE.tzid, "fr", t).title).toBe(
      "zmanim.shabbat.title",
    );

    const roch = plan({ rest: true, now: new Date(Date.UTC(2026, 8, 10, 12)) }).filter(
      (reminder) => !reminder.zman,
    )[0];
    expect(describeReminder(roch, DEFAULT_PLACE.tzid, "fr", t).title).toContain("Roch Hachana");
  });
});
