import { HDate } from "@hebcal/core";
import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson } from "../models/models";
import { localDayFrom } from "./dateService";
import { getTehilimOfHebrewDay } from "./dailyCycles";
import { getDafYomi, isLastDafOf } from "./dafYomi";
import type { DailyHistory } from "./dailyHistory";

/**
 * Ce que l'historique des journées (dailyHistory) permet de compter quand on
 * connaît le calendrier : les psaumes du cycle du jour, les dafim, les
 * siyoumim. À part de dailyHistory parce que hebcal pèse lourd et n'a rien à
 * faire dans le premier chargement de l'accueil.
 */

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;
const tehilimIds = new Set(
  allTexts.filter((e) => String(e.type) === "Tehilim").map((e) => String(e.id)),
);
const PRAYERS = new Set(["chaharit", "minha", "arvit"]);

/** Ce que les journées passées ont accumulé : des chiffres qui ne redescendent pas. */
export interface HistoryTotals {
  /** Journées réussies. */
  days: number;
  psalms: number;
  dafim: number;
  prayers: number;
  /** Actions et objectifs cochés, prières comprises. */
  actions: number;
}

export function historyTotals(history: DailyHistory): HistoryTotals {
  const totals: HistoryTotals = { days: 0, psalms: 0, dafim: 0, prayers: 0, actions: 0 };
  for (const [key, record] of Object.entries(history)) {
    if (record.ok) totals.days += 1;
    const day = localDayFrom(key);
    for (const item of record.keys) {
      if (tehilimIds.has(item)) totals.psalms += 1;
      else if (item === "tehilim-jour" && day) {
        totals.psalms += getTehilimOfHebrewDay(new HDate(day)).psalms.length;
      } else if (item === "daf-yomi") totals.dafim += 1;
      else if (PRAYERS.has(item)) {
        totals.prayers += 1;
        totals.actions += 1;
      } else if (!/^\d+$/.test(item) && item !== "parasha") totals.actions += 1;
    }
  }
  return totals;
}

/** Un traité fini : le jour où son dernier daf a été coché. */
export interface Siyoum {
  tractate: string;
  date: string;
}

/** Les siyoumim que l'historique contient, du plus récent au plus ancien. */
export function siyoumimOf(history: DailyHistory): Siyoum[] {
  const out: Siyoum[] = [];
  for (const [key, record] of Object.entries(history)) {
    if (!record.keys.includes("daf-yomi")) continue;
    const day = localDayFrom(key);
    const daf = day ? getDafYomi(day) : null;
    if (daf && isLastDafOf(daf)) out.push({ tractate: daf.tractate, date: key });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
