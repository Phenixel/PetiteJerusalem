import { addDays, dayRange, daysBetween, weekdayOf, weekOf } from "./days";
import type { CatchUpOption, DayKey, DayLog, ProgramObjective, Rhythm, UnitKind } from "./model";

/**
 * Le plan d'un programme : combien lire, et quand.
 *
 * Le programme avance d'un rythme régulier, de son départ (`base`) à sa date
 * de fin, sur ses **créneaux** : les jours (rythme quotidien), les jours sauf
 * Chabbat et les fêtes, ou les semaines (rythme à la semaine, la semaine se
 * nommant par son Chabbat). Au k-ième créneau sur N, on devrait en être à
 *
 *     rythme(k) = départ + (total - départ) × k / N
 *
 * La portion d'un créneau est ce que ce rythme ajoute, plus le rattrapage
 * qu'on y a posé (`extra`). Elle commence là où l'on en est vraiment, pas là
 * où l'on devrait en être : on lit toujours la suite de ce qu'on a lu.
 *
 * Le retard est l'écart entre où l'on devrait en être et où l'on en est,
 * hors du rattrapage déjà posé sur la suite. Il ne grossit jamais la portion
 * de lui-même : c'est à la personne de dire comment le rattraper (la feuille
 * « Rattraper »), et rien ne presse.
 *
 * L'avance, son contraire : ce qu'on a lu au-delà du rythme. Lire la suite
 * (`nextPortion`, la portion du prochain créneau) la fait. Elle ne change
 * pas le pas : les portions gardent leur taille, et la fin vient plus tôt.
 *
 * La position se compte sur le journal des jours (les unités lues chaque
 * jour) plus ce qu'on a déclaré lu sans jour (`credit`) : deux appareils qui
 * fusionnent leurs journées retombent sur la même position.
 */

/** Chabbat ou une fête : fourni par restDays.ts, ou par un test. */
export type RestCalendar = (day: DayKey) => boolean;

/** Ce qu'un créneau demande, et où l'on en est. */
export interface SlotState {
  /** Le créneau : le jour, ou le Chabbat de la semaine au rythme hebdomadaire. */
  slot: DayKey;
  /** Un créneau d'étude (pas un Chabbat au rythme « sauf Chabbat »). */
  study: boolean;
  /** Unités prévues ce créneau, rattrapage compris. */
  quota: number;
  /** La portion : de `from` à `to` (exclu), à partir de là où l'on en était. */
  from: number;
  to: number;
  /** Unités lues dans ce créneau. */
  done: number;
  /** La portion est lue. */
  complete: boolean;
  /** Retard à l'ouverture du créneau, hors rattrapage déjà posé. */
  behind: number;
  /** Avance : lu avant ce créneau au-delà du rythme, plus ce qu'il a lu au-delà de sa portion. */
  ahead: number;
  /** Tout est lu, ce créneau compris. */
  finished: boolean;
}

export interface ProgramPlan {
  readonly program: ProgramObjective;
  /** Le créneau d'un jour. */
  slotOf(day: DayKey): DayKey;
  /** L'état du créneau d'un jour. */
  state(day: DayKey): SlotState;
  /** Unités lues jusqu'au soir de `day` compris. */
  positionAt(day: DayKey): number;
  /**
   * La suite, une fois lu ce qu'on a lu ce jour-là : la portion du prochain
   * créneau d'étude, à partir de là où l'on en est. Rien quand tout est lu.
   */
  nextPortion(day: DayKey): { from: number; to: number } | null;
  /** Créneaux d'étude du départ à la fin. */
  readonly slotCount: number;
  /** La portion moyenne d'un créneau, sur le rythme actuel. */
  readonly average: number;
}

/** Le créneau d'un jour selon le rythme. */
export function slotOfDay(rhythm: Rhythm, day: DayKey): DayKey {
  return rhythm === "weekly" ? weekOf(day) : day;
}

/** Le jour compte-t-il au rythme donné ? (Une semaine compte toujours.) */
function isStudyDay(rhythm: Rhythm, day: DayKey, isRest: RestCalendar): boolean {
  return rhythm !== "weekdays" || !isRest(day);
}

/** Les créneaux d'étude de `from` à `to` (bornes comprises), dans l'ordre. */
export function studySlots(
  rhythm: Rhythm,
  from: DayKey,
  to: DayKey,
  isRest: RestCalendar,
): DayKey[] {
  if (rhythm === "weekly") {
    const out: DayKey[] = [];
    for (let week = weekOf(from); week <= weekOf(to); week = addDays(week, 7)) out.push(week);
    return out;
  }
  return dayRange(from, to).filter((day) => isStudyDay(rhythm, day, isRest));
}

/** Combien d'éléments de la liste triée sont inférieurs ou égaux à `key`. */
function countUpTo(sorted: DayKey[], key: DayKey): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= key) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Le plan d'un programme sur son journal. */
export function programPlan(
  program: ProgramObjective,
  days: Record<DayKey, DayLog>,
  isRest: RestCalendar,
): ProgramPlan {
  const { rhythm, total, base } = program;
  const slots = studySlots(rhythm, base.day, program.end, isRest);
  const slotSet = new Set(slots);
  const slotCount = Math.max(1, slots.length);
  const span = Math.max(0, total - base.position);

  const pace = (k: number): number =>
    Math.min(total, base.position + Math.round((span * Math.min(k, slotCount)) / slotCount));

  // Les unités lues, jour par jour, dans l'ordre : de quoi sommer vite.
  const logged = Object.keys(days)
    .filter((day) => (days[day].units?.[program.id] ?? 0) > 0)
    .sort();
  const prefix: number[] = [];
  let running = 0;
  for (const day of logged) {
    running += days[day].units![program.id];
    prefix.push(running);
  }
  const credit = program.credit ?? 0;
  /** Unités lues avant `day` (exclu). */
  const before = (day: DayKey): number => {
    const n = countUpTo(logged, addDays(day, -1));
    return credit + (n > 0 ? prefix[n - 1] : 0);
  };
  const positionAt = (day: DayKey): number => Math.min(total, before(addDays(day, 1)));

  const extras = program.extra ?? {};
  const extraKeys = Object.keys(extras).sort();
  /** Le rattrapage posé sur les créneaux à partir de `slot` (compris). */
  const extraFrom = (slot: DayKey): number =>
    extraKeys.filter((key) => key >= slot).reduce((sum, key) => sum + extras[key], 0);

  /** Le premier jour d'un créneau. */
  const slotStart = (slot: DayKey): DayKey => (rhythm === "weekly" ? addDays(slot, -6) : slot);

  const lastSlot = slots[slots.length - 1];
  const average = span / slotCount;

  function state(day: DayKey): SlotState {
    const slot = slotOfDay(rhythm, day);
    const study = rhythm === "weekly" || isStudyDay(rhythm, day, isRest);
    const k = countUpTo(slots, slot);
    const kBefore = study && slotSet.has(slot) ? k - 1 : k;
    const from = Math.min(total, before(slotStart(slot)));
    // Passé la date de fin sans avoir fini, le programme continue au même pas :
    // une date dépassée ne fait pas disparaître ce qui reste à lire.
    const overdue = lastSlot !== undefined && slot > lastSlot && from < total;
    const regular = overdue
      ? Math.max(1, Math.round(average))
      : Math.max(0, pace(k) - pace(kBefore));
    const quota = study ? regular + (extras[slot] ?? 0) : 0;
    const to = Math.min(total, from + quota);
    const done = Math.max(0, positionAt(rhythm === "weekly" ? slot : day) - from);
    const target = pace(kBefore) - extraFrom(slot);
    return {
      slot,
      study,
      quota,
      from,
      to,
      done,
      complete: quota > 0 && from + done >= to,
      behind: Math.max(0, target - from),
      ahead: Math.max(0, from - pace(kBefore)) + Math.max(0, done - quota),
      finished: from + done >= total,
    };
  }

  function nextPortion(day: DayKey): { from: number; to: number } | null {
    const position = positionAt(day);
    if (position >= total) return null;
    const slot = slotOfDay(rhythm, day);
    const next = slots.find((candidate) => candidate > slot);
    const quota = next ? state(slotStart(next)).quota : Math.max(1, Math.round(average));
    return { from: position, to: Math.min(total, position + Math.max(1, quota)) };
  }

  return {
    program,
    slotOf: (day) => slotOfDay(rhythm, day),
    state,
    positionAt,
    nextPortion,
    slotCount,
    average,
  };
}

/**
 * Le programme repris d'aujourd'hui, à la position atteinte : quand on change
 * sa date de fin ou son rythme, le nouveau pas se calcule sur ce qui reste,
 * pas depuis le premier jour. Le rattrapage posé s'efface avec l'ancien pas.
 */
export function rebase(
  program: ProgramObjective,
  change: Partial<Pick<ProgramObjective, "end" | "rhythm">>,
  today: DayKey,
  days: Record<DayKey, DayLog>,
  isRest: RestCalendar,
  now: number = Date.now(),
): ProgramObjective {
  const position = programPlan(program, days, isRest).positionAt(addDays(today, -1));
  const next: ProgramObjective = {
    ...program,
    ...change,
    base: { day: today, position },
    updatedAt: now,
  };
  delete next.extra;
  return next;
}

/**
 * Un programme qui reprend après une pause : la fin recule d'autant de jours
 * que la pause en a duré, et le pas repart d'aujourd'hui, de là où l'on en
 * était. Le temps de la pause ne s'est pas compté en retard ; sans cela, on
 * reprenait avec des semaines « de retard » qu'on avait choisi de ne pas lire.
 */
export function resumeProgram(
  program: ProgramObjective,
  today: DayKey,
  days: Record<DayKey, DayLog>,
  isRest: RestCalendar,
  now: number = Date.now(),
): ProgramObjective {
  const from = program.pausedFrom;
  const resumed = { ...program };
  delete resumed.pausedFrom;
  if (from === undefined || from >= today) return { ...resumed, updatedAt: now };
  const end = addDays(program.end, daysBetween(from, today));
  return rebase(resumed, { end }, today, days, isRest, now);
}

/** Le prochain dimanche à partir d'un jour (lui-même s'il en est un). */
const nextSunday = (day: DayKey): DayKey => addDays(day, (7 - weekdayOf(day)) % 7);

/**
 * Le programme tel qu'il sera après avoir rattrapé son retard d'aujourd'hui
 * de la façon choisie. Sans retard, il ne change pas.
 */
export function applyCatchUp(
  program: ProgramObjective,
  option: CatchUpOption,
  today: DayKey,
  days: Record<DayKey, DayLog>,
  isRest: RestCalendar,
  now: number = Date.now(),
): ProgramObjective {
  const plan = programPlan(program, days, isRest);
  const current = plan.state(today);
  const behind = current.behind;
  if (behind <= 0) return program;
  const slot = current.slot;
  // Le rattrapage posé sur les jours passés appartient au passé : il n'entre plus dans le calcul.
  const kept: Record<DayKey, number> = {};
  for (const [key, units] of Object.entries(program.extra ?? {})) {
    if (key >= slot) kept[key] = units;
  }
  const updated: ProgramObjective = { ...program, updatedAt: now };
  // Une date de fin déjà passée ne laisse rien sur quoi répartir : on la repousse.
  const choice: CatchUpOption = option === "remaining" && program.end < today ? "pushEnd" : option;

  switch (choice) {
    case "done":
      updated.credit = (program.credit ?? 0) + behind;
      break;
    case "remaining":
      updated.base = { day: today, position: current.from };
      delete updated.extra;
      break;
    case "pushEnd": {
      // Même rythme qu'avant : autant de créneaux de plus que le retard en demande.
      const rate = Math.max(plan.average, 1e-9);
      const needed = Math.max(1, Math.ceil((program.total - current.from) / rate));
      const far = addDays(today, rhythmHorizon(program.rhythm, needed));
      const ahead = studySlots(program.rhythm, today, far, isRest);
      const lastSlot = ahead[Math.min(needed, ahead.length) - 1] ?? program.end;
      updated.base = { day: today, position: current.from };
      updated.end = lastSlot;
      delete updated.extra;
      break;
    }
    case "oneDay": {
      const target =
        program.rhythm === "weekly" ? slot : firstStudyFrom(program, nextSunday(today), isRest);
      kept[target] = (kept[target] ?? 0) + behind;
      updated.extra = kept;
      break;
    }
    case "week": {
      const targets =
        program.rhythm === "weekly"
          ? [slot]
          : studySlots(program.rhythm, today, weekOf(today), isRest);
      // Un Chabbat, la semaine est finie : le rattrapage passe au premier jour d'étude.
      const spread = targets.length
        ? targets
        : [firstStudyFrom(program, addDays(today, 1), isRest)];
      spread.forEach((key, i) => {
        const share = Math.floor(behind / spread.length) + (i < behind % spread.length ? 1 : 0);
        if (share > 0) kept[key] = (kept[key] ?? 0) + share;
      });
      updated.extra = kept;
      break;
    }
  }
  return updated;
}

/** Assez de jours devant soi pour trouver `slots` créneaux d'étude. */
function rhythmHorizon(rhythm: Rhythm, slots: number): number {
  if (rhythm === "weekly") return slots * 7 + 7;
  // Chabbat et les fêtes retirent au plus un jour sur six, Souccot et Pessa'h compris.
  return Math.ceil(slots * 1.3) + 30;
}

/** Le premier jour d'étude à partir de `day`. */
function firstStudyFrom(program: ProgramObjective, day: DayKey, isRest: RestCalendar): DayKey {
  let candidate = day;
  for (let i = 0; i < 14 && !isStudyDay(program.rhythm, candidate, isRest); i++) {
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

/**
 * Le temps qu'une unité demande, en minutes, pour dire « 12 min environ ».
 * Des ordres de grandeur, pas une promesse : une michna se lit en quatre
 * minutes avec son explication simple, un côté de daf en un quart d'heure.
 */
export const MINUTES_PER_UNIT: Record<UnitKind, number> = {
  mishna: 4,
  amud: 15,
  chapter: 6,
  psalm: 3,
};

/** Les minutes d'une portion : telles quelles sous vingt, à cinq près au-delà. */
export function portionMinutes(unit: UnitKind, units: number): number {
  const minutes = MINUTES_PER_UNIT[unit] * units;
  return minutes < 20 ? Math.max(1, minutes) : Math.round(minutes / 5) * 5;
}

/** La date de fin d'un rythme donné : pour l'étape « pour quand », dans l'autre sens. */
export function endForRate(
  rhythm: Rhythm,
  start: DayKey,
  units: number,
  perSlot: number,
  isRest: RestCalendar,
): DayKey {
  const needed = Math.max(1, Math.ceil(units / Math.max(perSlot, 1)));
  const ahead = studySlots(rhythm, start, addDays(start, rhythmHorizon(rhythm, needed)), isRest);
  return ahead[Math.min(needed, ahead.length) - 1] ?? start;
}
