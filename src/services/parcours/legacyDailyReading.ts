import { setTaskDone } from "./actions";
import { weekOf, weekStart, addDays } from "./days";
import { ALL_WEEK, isAlive } from "./model";
import type { CycleObjective, DayKey, ParcoursData, TextObjective } from "./model";
import type { Task } from "./schedule";

/**
 * La lecture du jour d'avant Mon parcours, et Mon parcours.
 *
 * Elle vivait dans le profil du compte (`userPreferences/{uid}`) : la liste
 * des textes (`dailyReadingIds`), les lectures du moment (`dailyReadingOptions` :
 * les Tehilim du jour, la paracha en chnei mikra) et ce qui était lu le jour
 * même (`dailyReadingProgress`). Ces champs, des versions de l'app déjà
 * installées les lisent et les écrivent encore, comme les widgets, la montre
 * et le rappel du soir (functions/src/dailyReminder.ts).
 *
 * Mon parcours les reprend donc sans les remplacer :
 *
 *  - à la connexion, chaque texte et chaque lecture du moment devient un
 *    objectif, sous un identifiant tiré de lui (`daily-text-103`,
 *    `daily-tehilim`, `daily-parasha`), le même sur tous les appareils ;
 *    ce qui était lu aujourd'hui y est coché ;
 *  - ensuite, Mon parcours tient ces champs à jour à chaque changement
 *    (`legacyProjection`), pour que tout ce qui les lit dise la même chose.
 *
 * Les listes d'avant ne font qu'AJOUTER : un texte qu'une ancienne version
 * aurait ajouté entre ici ; un texte retiré dans Mon parcours n'y revient pas,
 * même si une copie ancienne des listes le portait encore.
 */

export const LEGACY_TEXT_PREFIX = "daily-text-";
export const LEGACY_TEHILIM_ID = "daily-tehilim";
export const LEGACY_PARASHA_ID = "daily-parasha";

/** Les options de la lecture du jour d'avant, et le cycle qui les reprend. */
const OPTION_CYCLES = {
  "tehilim-jour": { id: LEGACY_TEHILIM_ID, cycle: "tehilim-month" },
  parasha: { id: LEGACY_PARASHA_ID, cycle: "parasha" },
} as const;

type LegacyOption = keyof typeof OPTION_CYCLES;

/** Ce que portait le profil pour la lecture du jour (champs de UserPreferences). */
export interface LegacyDailyReading {
  ids: number[];
  options: string[];
  progress: {
    date: string;
    completedIds: number[];
    completedOptions?: string[];
    parashaProgress?: { week: string; completed: boolean };
  };
}

/** L'objectif d'un texte de la lecture du jour. */
export const legacyTextId = (textId: number): string => `${LEGACY_TEXT_PREFIX}${textId}`;

/** Un texte de la lecture du jour, tel que Mon parcours le reprend. */
export function legacyTextObjective(textId: number, since: DayKey, now: number): TextObjective {
  return {
    id: legacyTextId(textId),
    kind: "text",
    textId,
    days: [...ALL_WEEK],
    moment: "morning",
    since,
    createdAt: now,
    updatedAt: now,
  };
}

/** Une lecture du moment, telle que Mon parcours la reprend. */
export function legacyCycleObjective(
  option: LegacyOption,
  since: DayKey,
  now: number,
): CycleObjective {
  const { id, cycle } = OPTION_CYCLES[option];
  return {
    id,
    kind: "cycle",
    cycle,
    moment: cycle === "parasha" ? "anytime" : "morning",
    since,
    createdAt: now,
    updatedAt: now,
  };
}

const isLegacyOption = (option: string): option is LegacyOption => option in OPTION_CYCLES;

/** Une tâche à cocher pour reprendre ce qui était lu (sans plan de programme). */
const plainTask = (id: string, weekly: boolean): Task => ({
  id,
  objectiveId: id,
  kind: weekly ? "cycle" : "text",
  moment: "morning",
  weekly,
});

/**
 * Reprend la lecture du jour d'avant dans Mon parcours : les objectifs qui
 * manquent, et ce qui a été lu aujourd'hui.
 */
export function importLegacy(
  data: ParcoursData,
  legacy: LegacyDailyReading,
  today: DayKey,
  now: number = Date.now(),
): ParcoursData {
  let next = data;
  const objectives = { ...data.objectives };
  let added = false;
  for (const textId of legacy.ids) {
    const id = legacyTextId(textId);
    if (objectives[id]) continue;
    objectives[id] = legacyTextObjective(textId, today, now);
    added = true;
  }
  for (const option of legacy.options) {
    if (!isLegacyOption(option)) continue;
    const id = OPTION_CYCLES[option].id;
    if (objectives[id]) continue;
    objectives[id] = legacyCycleObjective(option, today, now);
    added = true;
  }
  if (added) next = { ...next, objectives };

  // Ce qui a été lu aujourd'hui, ailleurs : le « lu » gagne, rien ne se décoche.
  const progress = legacy.progress;
  const doneToday = new Set(next.days[today]?.done ?? []);
  const alive = (id: string) => next.objectives[id] && isAlive(next.objectives[id]);
  if (progress.date === today) {
    for (const textId of progress.completedIds) {
      const id = legacyTextId(textId);
      if (alive(id) && !doneToday.has(id))
        next = setTaskDone(next, plainTask(id, false), today, true, now);
    }
    if (
      progress.completedOptions?.includes("tehilim-jour") &&
      alive(LEGACY_TEHILIM_ID) &&
      !doneToday.has(LEGACY_TEHILIM_ID)
    ) {
      next = setTaskDone(next, plainTask(LEGACY_TEHILIM_ID, false), today, true, now);
    }
  }
  const parasha = progress.parashaProgress;
  if (
    parasha?.completed &&
    parasha.week === weekOf(today) &&
    alive(LEGACY_PARASHA_ID) &&
    !doneThisWeek(next, LEGACY_PARASHA_ID, today)
  ) {
    next = setTaskDone(next, plainTask(LEGACY_PARASHA_ID, true), today, true, now);
  }
  return next;
}

function doneThisWeek(data: ParcoursData, id: string, day: DayKey): boolean {
  for (let d = weekStart(day); d <= day; d = addDays(d, 1)) {
    if (data.days[d]?.done.includes(id)) return true;
  }
  return false;
}

/** Ce que Mon parcours écrit dans les champs d'avant, pour qui les lit encore. */
export interface LegacyProjection {
  dailyReadingIds: number[];
  dailyReadingOptions: string[];
  dailyReadingProgress: LegacyDailyReading["progress"];
}

const activeToday = (data: ParcoursData, id: string, today: DayKey): boolean => {
  const objective = data.objectives[id];
  return (
    objective !== undefined &&
    isAlive(objective) &&
    (objective.pausedFrom === undefined || objective.pausedFrom > today)
  );
};

export function legacyProjection(data: ParcoursData, today: DayKey): LegacyProjection {
  const texts = Object.values(data.objectives).filter(
    (o): o is TextObjective => o.kind === "text" && activeToday(data, o.id, today),
  );
  const options: string[] = [];
  if (activeToday(data, LEGACY_TEHILIM_ID, today)) options.push("tehilim-jour");
  if (activeToday(data, LEGACY_PARASHA_ID, today)) options.push("parasha");
  const done = new Set(data.days[today]?.done ?? []);
  return {
    dailyReadingIds: texts.map((o) => o.textId).sort((a, b) => a - b),
    dailyReadingOptions: options,
    dailyReadingProgress: {
      date: today,
      completedIds: texts
        .filter((o) => done.has(o.id))
        .map((o) => o.textId)
        .sort((a, b) => a - b),
      completedOptions: done.has(LEGACY_TEHILIM_ID) ? ["tehilim-jour"] : [],
      parashaProgress: {
        week: weekOf(today),
        completed: doneThisWeek(data, LEGACY_PARASHA_ID, today),
      },
    },
  };
}
