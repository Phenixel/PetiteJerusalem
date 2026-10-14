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
  HabitAnchor,
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
 * soir, et ne se doublent pas d'un appareil à l'autre. Les Tehilim de la
 * semaine, nouveaux, ont un identifiant fixe à eux.
 */

/** Ce qu'une habitude proposée demande d'office : son moment, ses jours, son repère sur le fil. */
export const HABIT_DEFAULTS: Record<
  HabitPreset,
  { moment: MomentId; days: readonly number[]; anchor?: HabitAnchor }
> = {
  // Les offices ont chacun leur moment (voir TEFILOT_STEPS) ; Chabbat compris.
  tefilot: { moment: "morning", days: ALL_WEEK },
  // Pas de tefilin à Chabbat, pas d'argent non plus.
  tefilin: { moment: "morning", days: WEEKDAYS_WITHOUT_CHABBAT, anchor: "chaharit" },
  "chema-al-hamita": { moment: "bedtime", days: ALL_WEEK, anchor: "bedtime" },
  // Après chaque repas, Chabbat compris : le repère de midi.
  "birkat-hamazon": { moment: "afternoon", days: ALL_WEEK, anchor: "noon" },
  tsedaka: { moment: "anytime", days: WEEKDAYS_WITHOUT_CHABBAT },
  "chmirat-halachon": { moment: "anytime", days: ALL_WEEK },
  // Un temps d'étude, quand on veut dans la journée, Chabbat compris.
  limoud: { moment: "anytime", days: ALL_WEEK },
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
  /** À la semaine : les jours où sa carte vient sur l'accueil. */
  cardDays?: number[];
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
    ...(draft.rhythm === "weekly" && draft.cardDays ? { cardDays: [...draft.cardDays] } : {}),
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
  /** Le repère sur le fil du jour, s'il est posé. */
  anchor?: HabitAnchor;
}

export function createHabit(draft: HabitDraft, today: DayKey, now: number): HabitObjective {
  return {
    id: newObjectiveId(),
    kind: "habit",
    preset: draft.preset,
    name: draft.name.trim().slice(0, 60),
    days: [...draft.days].sort((a, b) => a - b),
    moment: draft.moment,
    ...(draft.anchor ? { anchor: draft.anchor } : {}),
    since: today,
    createdAt: now,
    updatedAt: now,
  };
}

/** L'identifiant d'une lecture du calendrier : celui de la lecture du jour d'avant. */
/** Les Tehilim de la semaine : un cycle de Mon parcours, sans lecture du jour d'avant. */
export const TEHILIM_WEEK_ID = "cycle-tehilim-week";

export const cycleObjectiveId = (cycle: CycleId): string =>
  cycle === "tehilim-week"
    ? TEHILIM_WEEK_ID
    : cycle === "tehilim-month"
      ? LEGACY_TEHILIM_ID
      : LEGACY_PARASHA_ID;

export function createCycle(cycle: CycleId, today: DayKey, now: number): CycleObjective {
  if (cycle === "tehilim-week") {
    return {
      id: TEHILIM_WEEK_ID,
      kind: "cycle",
      cycle,
      moment: "morning",
      since: today,
      createdAt: now,
      updatedAt: now,
    };
  }
  return legacyCycleObjective(cycle === "tehilim-month" ? "tehilim-jour" : "parasha", today, now);
}

export function createText(textId: number, today: DayKey, now: number): TextObjective {
  return legacyTextObjective(textId, today, now);
}
