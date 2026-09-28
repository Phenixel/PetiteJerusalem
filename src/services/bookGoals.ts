import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { sectionPath } from "../content/etudeTexts";
import { localDayFrom } from "./dateService";
import type { TextContent } from "./textService";
import { customWindow, type DailyGoal } from "./dailyActions";

/**
 * Finir un livre sur une période : un traité de Guemara ou de Michna, choisi
 * dans le catalogue, découpé en portions quotidiennes sur les jours qu'on se
 * donne. L'unité est le côté de daf (amoud) pour la Guemara, la michna pour
 * la Michna.
 *
 * Le plan se recalcule chaque jour à partir de ce qui reste : la portion du
 * jour est ce qu'il reste divisé par les jours qui restent. Un jour manqué
 * n'est donc pas perdu, il se rattrape de lui-même, réparti sur la suite ; un
 * jour d'avance allège les suivants. Le livre finit à la date prévue.
 *
 * Le découpage (unités par chapitre) est calculé à la création de l'objectif,
 * en lisant le fichier du texte, et gardé avec lui : la page n'a pas à
 * recharger un traité entier pour dire « aujourd'hui, daf 12a à 12b ».
 */
export interface BookSection {
  /** L'index de la section (chapitre) dans le texte, celui des URL. */
  index: number;
  /** Unités de la section : côtés de daf, ou michnayot. */
  units: number;
  /** Guemara : le premier côté de daf du chapitre (« 7b »). */
  firstDaf?: string;
}

export type BookUnitKind = "amud" | "mishna";

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;

/** Les livres qu'on peut se donner à finir : les traités du Talmud et de la Michna. */
export function bookCandidates(): TextStudyJsonEntry[] {
  return allTexts.filter((e) => String(e.type) === "Talmud Bavli" || String(e.type) === "Mishna");
}

export function bookEntry(goal: DailyGoal): TextStudyJsonEntry | null {
  if (goal.textId === undefined) return null;
  return allTexts.find((e) => String(e.id) === String(goal.textId)) ?? null;
}

export function bookUnitKind(goal: DailyGoal): BookUnitKind {
  return String(bookEntry(goal)?.type) === "Talmud Bavli" ? "amud" : "mishna";
}

/** Le découpage d'un texte chargé, à garder avec l'objectif. */
export function buildBookSections(content: TextContent): BookSection[] {
  return content.sections
    .map((section) =>
      section.dafBlocks?.length
        ? {
            index: section.index,
            units: section.dafBlocks.length,
            firstDaf: section.dafBlocks[0].daf,
          }
        : { index: section.index, units: section.he.length },
    )
    .filter((section) => section.units > 0);
}

export function totalUnits(goal: DailyGoal): number {
  return (goal.sections ?? []).reduce((sum, s) => sum + s.units, 0);
}

/** Où l'on en est, et ce qu'il y a à lire aujourd'hui. */
export interface BookPlan {
  /** Rang du jour dans la période (1..days), 0 hors de la période. */
  day: number;
  days: number;
  total: number;
  unitsDone: number;
  /** La portion du jour : unités [from, to). */
  from: number;
  to: number;
  /** Unités de retard sur le rythme régulier, réparties sur la suite. */
  behind: number;
  finished: boolean;
}

export function bookPlan(goal: DailyGoal, unitsDone: number, today: string): BookPlan {
  const total = totalUnits(goal);
  const window = customWindow(goal);
  const days = window?.days ?? 1;
  let day = 0;
  if (window) {
    const start = localDayFrom(window.start);
    const now = localDayFrom(today);
    if (start && now) {
      day = Math.round((now.getTime() - start.getTime()) / 86_400_000) + 1;
      if (day < 1) day = 0;
    }
  }
  const done = Math.min(total, Math.max(0, unitsDone));
  const finished = total > 0 && done >= total;
  const remaining = total - done;
  // Passé la période, tout ce qui reste est pour aujourd'hui.
  const remainingDays = day === 0 ? days : Math.max(1, days - day + 1);
  const portion = finished ? 0 : Math.ceil(remaining / remainingDays);
  const scheduled = day === 0 ? 0 : Math.round((total * (day - 1)) / days);
  return {
    day: day > days ? days : day,
    days,
    total,
    unitsDone: done,
    from: done,
    to: Math.min(total, done + portion),
    behind: Math.max(0, scheduled - done),
    finished,
  };
}

/** L'emplacement d'une unité : sa section, son rang dedans, son côté de daf. */
export interface UnitPlace {
  sectionIndex: number;
  /** Rang dans la section, base 0. */
  offset: number;
  daf?: string;
}

export function unitPlace(goal: DailyGoal, unit: number): UnitPlace | null {
  let cursor = 0;
  for (const section of goal.sections ?? []) {
    if (unit < cursor + section.units) {
      const offset = unit - cursor;
      return {
        sectionIndex: section.index,
        offset,
        daf: section.firstDaf ? dafAfter(section.firstDaf, offset) : undefined,
      };
    }
    cursor += section.units;
  }
  return null;
}

/** « 7b » puis 3 côtés plus loin → « 9a ». */
function dafAfter(firstDaf: string, offset: number): string {
  const m = /^(\d+)([ab])$/.exec(firstDaf);
  if (!m) return firstDaf;
  const sides = Number(m[1]) * 2 + (m[2] === "b" ? 1 : 0) + offset;
  return `${Math.floor(sides / 2)}${sides % 2 === 0 ? "a" : "b"}`;
}

type Translate = (key: string, params?: Record<string, unknown>) => string;

/** « Daf 12a à 13b », « Chapitre 2, michnayot 3 à 5 » : la portion en clair. */
export function portionLabel(goal: DailyGoal, from: number, to: number, t: Translate): string {
  if (to <= from) return "";
  const first = unitPlace(goal, from);
  const last = unitPlace(goal, to - 1);
  if (!first || !last) return "";
  if (bookUnitKind(goal) === "amud") {
    return first.daf === last.daf
      ? t("dailyReading.goals.book.dafOne", { daf: first.daf })
      : t("dailyReading.goals.book.dafRange", { from: first.daf, to: last.daf });
  }
  if (first.sectionIndex === last.sectionIndex) {
    return first.offset === last.offset
      ? t("dailyReading.goals.book.mishnaOne", { chapter: first.sectionIndex, n: first.offset + 1 })
      : t("dailyReading.goals.book.mishnaRange", {
          chapter: first.sectionIndex,
          from: first.offset + 1,
          to: last.offset + 1,
        });
  }
  return t("dailyReading.goals.book.mishnaAcross", {
    fromChapter: first.sectionIndex,
    from: first.offset + 1,
    toChapter: last.sectionIndex,
    to: last.offset + 1,
  });
}

/** Le chemin de lecture de la portion : la section où elle commence. */
export function portionPath(goal: DailyGoal, from: number): string | null {
  const entry = bookEntry(goal);
  const place = unitPlace(goal, from);
  return entry && place ? sectionPath(entry, place.sectionIndex) : null;
}
