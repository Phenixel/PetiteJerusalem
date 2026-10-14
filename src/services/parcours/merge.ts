import { isDayKey } from "./days";
import { emptyParcours } from "./model";
import type { DayKey, DayLog, Objective, ParcoursData } from "./model";

/**
 * Lire, fusionner et comparer des données de Mon parcours venues d'ailleurs :
 * de l'appareil, du compte, d'une autre version de l'app.
 *
 * La fusion se fait entrée par entrée : un objectif, un jour. La plus récente
 * gagne (`updatedAt`, `at`), retrait compris. Deux appareils qui ont coché des
 * choses différentes le même jour gardent la dernière écriture de ce jour-là :
 * c'est rare, et c'est ce qui permet de décocher.
 *
 * La lecture est indulgente : une entrée illisible est écartée sans faire
 * tomber le reste. Et elle garde ce qu'elle ne connaît pas : un objectif d'une
 * sorte qu'une version plus récente a inventée reste dans les données, ignoré
 * des calculs, pour ne pas le perdre en réécrivant.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/** Un objectif lisible : ses champs communs suffisent, le reste se lit à l'usage. */
function parseObjective(id: string, value: unknown): Objective | null {
  if (!isRecord(value)) return null;
  if (value.id !== id || typeof value.kind !== "string") return null;
  if (typeof value.updatedAt !== "number" || !isDayKey(value.since)) return null;
  if (typeof value.createdAt !== "number") return null;
  return value as unknown as Objective;
}

function parseDay(value: unknown): DayLog | null {
  if (!isRecord(value) || typeof value.at !== "number" || !isStringList(value.done)) return null;
  const log: DayLog = { done: value.done, at: value.at };
  if (isRecord(value.units)) {
    const units: Record<string, number> = {};
    for (const [id, n] of Object.entries(value.units)) {
      if (typeof n === "number" && Number.isFinite(n) && n >= 0) units[id] = n;
    }
    log.units = units;
  }
  if (isStringList(value.skipped)) log.skipped = value.skipped;
  return log;
}

/** Des données de Mon parcours, d'où qu'elles viennent ; vides si rien n'est lisible. */
export function parseParcours(value: unknown): ParcoursData {
  const data = emptyParcours();
  if (!isRecord(value)) return data;
  if (isRecord(value.objectives)) {
    for (const [id, raw] of Object.entries(value.objectives)) {
      const objective = parseObjective(id, raw);
      if (objective) data.objectives[id] = objective;
    }
  }
  if (isRecord(value.days)) {
    for (const [day, raw] of Object.entries(value.days)) {
      const log = parseDay(raw);
      if (log && isDayKey(day)) data.days[day] = log;
    }
  }
  return data;
}

const newerObjective = (a: Objective | undefined, b: Objective | undefined) =>
  !a ? b : !b ? a : b.updatedAt > a.updatedAt ? b : a;

const newerDay = (a: DayLog | undefined, b: DayLog | undefined) =>
  !a ? b : !b ? a : b.at > a.at ? b : a;

/** La fusion de deux versions : entrée par entrée, la plus récente. */
export function mergeParcours(a: ParcoursData, b: ParcoursData): ParcoursData {
  const merged = emptyParcours();
  for (const id of new Set([...Object.keys(a.objectives), ...Object.keys(b.objectives)])) {
    merged.objectives[id] = newerObjective(a.objectives[id], b.objectives[id])!;
  }
  for (const day of new Set([...Object.keys(a.days), ...Object.keys(b.days)])) {
    merged.days[day] = newerDay(a.days[day], b.days[day])!;
  }
  return merged;
}

/** Les entrées qui diffèrent d'une version à l'autre : ce qu'il faut écrire. */
export interface ParcoursChanges {
  objectives: string[];
  days: DayKey[];
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export function changedEntries(from: ParcoursData, to: ParcoursData): ParcoursChanges {
  return {
    objectives: Object.keys(to.objectives).filter(
      (id) => !same(from.objectives[id], to.objectives[id]),
    ),
    days: Object.keys(to.days).filter((day) => !same(from.days[day], to.days[day])),
  };
}

export const hasChanges = (changes: ParcoursChanges): boolean =>
  changes.objectives.length > 0 || changes.days.length > 0;
