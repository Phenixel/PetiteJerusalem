import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { HDate, HebrewCalendar, months } from "@hebcal/core";
import { chosenMonthOf, hebrewDate, shownDayAndMonth } from "../services/hebrewDateConverter";

/**
 * Le convertisseur, onglet hébraïque : le jour et le mois CHOISIS se gardent à
 * part de ce qui s'affiche pour l'année en cours. Une année qui n'a pas ce
 * mois ou ce jour montre le plus proche, sans oublier le choix.
 *
 * Avant : le 14 Adar II 5787, puis « Année suivante » trois fois, donnait en
 * 5790 le 14 Adar I (Pourim Katan, 17 février 2030) au lieu du 14 Adar II
 * (Pourim, 19 mars 2030) ; le 30 'Hechvan 5785 devenait 29 après une année
 * courte et n'en revenait pas.
 *
 * Repères (hebcal) : 5785 ordinaire, 'Hechvan de 30 ; 5786 ordinaire,
 * 'Hechvan de 29 ; 5787 treize mois ; 5788 et 5789 ordinaires ; 5790 treize
 * mois, 'Hechvan de 29.
 */

vi.mock("../services/analyticsService", () => ({ analyticsService: { capture: vi.fn() } }));

const holidays = (hd: HDate) =>
  (HebrewCalendar.getHolidaysOnDate(hd) ?? []).map((event) => event.getDesc());

/** Ce que fait le formulaire, année après année, avec un choix fixe. */
function walk(day: number, month: number, years: number[]) {
  return years.map((year) => ({
    year,
    shown: shownDayAndMonth(day, month, year),
    date: hebrewDate(day, month, year),
  }));
}

describe("le choix survit aux années qui ne l'ont pas", () => {
  it("14 Adar II 5787, trois ans plus tard : Pourim en Adar II, pas Pourim Katan", () => {
    const steps = walk(14, chosenMonthOf(months.ADAR_II, 5787), [5788, 5789, 5790]);
    expect(steps.map((s) => s.shown.month)).toEqual([months.ADAR_I, months.ADAR_I, months.ADAR_II]);
    const last = steps[2].date;
    expect([last.getDate(), last.getMonth()]).toEqual([14, months.ADAR_II]);
    expect(last.greg()).toEqual(new Date(2030, 2, 19));
    expect(holidays(last)).toContain("Purim");
  });

  it("Adar choisi dans une année ordinaire revient en Adar II, comme Pourim et hebcal", () => {
    const month = chosenMonthOf(months.ADAR_I, 5788);
    expect(month).toBe(months.ADAR_II);
    // L'année ordinaire l'affiche toujours « Adar ».
    expect(shownDayAndMonth(14, month, 5788).month).toBe(months.ADAR_I);
    const leap = hebrewDate(14, month, 5790);
    expect(holidays(leap)).toContain("Purim");
    // hebcal fait de même pour un anniversaire né en Adar d'une année ordinaire.
    const anniversary = HebrewCalendar.getBirthdayOrAnniversary(
      5790,
      new HDate(14, months.ADAR_I, 5788),
    );
    expect(anniversary?.getMonth()).toBe(months.ADAR_II);
  });

  it("Adar I choisi dans une année à treize mois reste Adar I", () => {
    const month = chosenMonthOf(months.ADAR_I, 5787);
    expect(month).toBe(months.ADAR_I);
    const steps = walk(14, month, [5788, 5790]);
    expect(steps[1].shown.month).toBe(months.ADAR_I);
    expect(holidays(steps[1].date)).toContain("Purim Katan");
  });

  it("30 'Hechvan 5785 : 29 en 5786, puis de nouveau 30 en 5787", () => {
    const steps = walk(30, chosenMonthOf(months.CHESHVAN, 5785), [5786, 5787, 5788, 5789, 5790]);
    expect(steps.map((s) => s.shown.day)).toEqual([29, 30, 30, 29, 29]);
    for (const step of steps) {
      expect(step.date.getMonth()).toBe(months.CHESHVAN);
      expect(step.date.getDate()).toBe(step.shown.day);
    }
  });

  it("les autres mois passent d'une année à l'autre sans changer", () => {
    for (const year of [5785, 5786, 5787, 5790]) {
      expect(shownDayAndMonth(15, months.NISAN, year)).toEqual({ day: 15, month: months.NISAN });
      expect(chosenMonthOf(months.NISAN, year)).toBe(months.NISAN);
    }
  });
});

describe("le formulaire du convertisseur", () => {
  let host: HTMLElement | null = null;
  afterEach(() => {
    host?.remove();
    document.body.innerHTML = "";
  });

  async function open(today: HDate) {
    const { default: fr } = await import("../locales/fr");
    const { default: DateConverterModal } = await import("../views/Zmanim/DateConverterModal.vue");
    const { DEFAULT_PLACE } = await import("../services/zmanimService");
    const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
    host = document.createElement("div");
    document.body.appendChild(host);
    createApp({
      render: () =>
        h(DateConverterModal, {
          open: true,
          today,
          place: DEFAULT_PLACE,
        }),
    })
      .use(i18n)
      .mount(host);
    await nextTick();
    const button = (label: string) =>
      document.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
    const fields = () =>
      [...document.querySelectorAll('[role="combobox"]')].map((el) => el.textContent?.trim());
    const next = async () => {
      button(fr.calendar.nextYear).click();
      await nextTick();
      await nextTick();
    };
    const result = () => document.querySelector('[aria-live="polite"]')?.textContent ?? "";
    return { next, fields, result };
  }

  it("14 Adar II 5787, « Année suivante » trois fois : 14 Adar II 5790, Pourim", async () => {
    const form = await open(new HDate(14, months.ADAR_II, 5787));
    await form.next();
    await form.next();
    await form.next();
    const [day, month] = form.fields();
    expect(day).toBe("14");
    expect(month).toMatch(/Adar II/);
    expect(form.result()).toContain("19 mars 2030");
  });

  it("30 'Hechvan 5785 : 29 l'année suivante, 30 l'année d'après", async () => {
    const form = await open(new HDate(30, months.CHESHVAN, 5785));
    await form.next();
    expect(form.fields()[0]).toBe("29");
    await form.next();
    expect(form.fields()[0]).toBe("30");
  });
});
