import {
  LEGACY_PARASHA_ID,
  LEGACY_TEHILIM_ID,
  legacyCycleObjective,
  legacyTextObjective,
} from "./legacyDailyReading";
import { ALL_WEEK, WEEKDAYS_WITHOUT_CHABBAT, newObjectiveId } from "./model";
import type {
  CycleId,
  CycleObjective,
  DayKey,
  HabitObjective,
  HabitPreset,
  MomentId,
  ProgramCorpus,
  ProgramObjective,
  ProgramPart,
  Rhythm,
  TextObjective,
} from "./model";
import { resolveParts, totalOf } from "./texts";

/**
 * Les objectifs neufs, tels que la page « Nouvel objectif » les crée.
 *
 * Une lecture du calendrier et un texte du jour prennent l'identifiant que la
 * lecture du jour d'avant leur donne (legacyDailyReading.ts) : créés ici, ils
 * paraissent aussi dans les versions installées, les widgets et le rappel du
 * soir, et ne se doublent pas d'un appareil à l'autre.
 */

/** Ce qu'une habitude proposée demande d'office : son moment et ses jours. */
export const HABIT_DEFAULTS: Record<HabitPreset, { moment: MomentId; days: readonly number[] }> = {
  // Les offices ont chacun leur moment (voir TEFILOT_STEPS) ; Chabbat compris.
  tefilot: { moment: "morning", days: ALL_WEEK },
  // Pas de tefilin à Chabbat, pas d'argent non plus.
  tefilin: { moment: "morning", days: WEEKDAYS_WITHOUT_CHABBAT },
  "chema-al-hamita": { moment: "bedtime", days: ALL_WEEK },
  tsedaka: { moment: "anytime", days: WEEKDAYS_WITHOUT_CHABBAT },
  "chmirat-halachon": { moment: "anytime", days: ALL_WEEK },
  custom: { moment: "anytime", days: WEEKDAYS_WITHOUT_CHABBAT },
};

/** Le moment d'un programme qu'on vient de créer : le soir, comme la lecture d'un chiour. */
export const PROGRAM_DEFAULT_MOMENT: MomentId = "evening";

export interface ProgramDraft {
  corpus: ProgramCorpus;
  parts: ProgramPart[];
  rhythm: Rhythm;
  end: DayKey;
  moment: MomentId;
}

export function createProgram(draft: ProgramDraft, today: DayKey, now: number): ProgramObjective {
  const texts = resolveParts(draft.corpus, draft.parts);
  return {
    id: newObjectiveId(),
    kind: "program",
    corpus: draft.corpus,
    parts: [...draft.parts],
    texts,
    total: totalOf(texts),
    rhythm: draft.rhythm,
    end: draft.end,
    base: { day: today, position: 0 },
    moment: draft.moment,
    since: today,
    createdAt: now,
    updatedAt: now,
  };
}

export interface HabitDraft {
  preset: HabitPreset;
  name: string;
  days: number[];
  moment: MomentId;
}

export function createHabit(draft: HabitDraft, today: DayKey, now: number): HabitObjective {
  return {
    id: newObjectiveId(),
    kind: "habit",
    preset: draft.preset,
    name: draft.name.trim().slice(0, 60),
    days: [...draft.days].sort((a, b) => a - b),
    moment: draft.moment,
    since: today,
    createdAt: now,
    updatedAt: now,
  };
}

/** L'identifiant d'une lecture du calendrier : celui de la lecture du jour d'avant. */
export const cycleObjectiveId = (cycle: CycleId): string =>
  cycle === "tehilim-month" ? LEGACY_TEHILIM_ID : LEGACY_PARASHA_ID;

export function createCycle(cycle: CycleId, today: DayKey, now: number): CycleObjective {
  return legacyCycleObjective(cycle === "tehilim-month" ? "tehilim-jour" : "parasha", today, now);
}

export function createText(textId: number, today: DayKey, now: number): TextObjective {
  return legacyTextObjective(textId, today, now);
}
