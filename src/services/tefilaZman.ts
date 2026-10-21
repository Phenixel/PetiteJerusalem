import { liturgicalDay, nightEndOf } from "./nightBounds";
import {
  computeZmanim,
  placeDayAfter,
  slihotWindow,
  type ZmanKey,
  type ZmanimPlace,
} from "./zmanimService";

/**
 * The time of a moment of prayer, as the reader shows it: the pill set
 * before what is read (« Min'ha jusqu'à 18:51 · encore 2 h 21 ») and the
 * sheet it opens, which draws the course of the sun with each landmark of
 * the moment (see TefilaZman.vue).
 *
 * A moment is a window (`start` to `end`) and the landmarks inside it. The
 * day ones are read on the civil day of the place; the night ones (Arvit,
 * the Sli'hot) on the night in progress, which began the evening before
 * when it is not yet dawn.
 */

export const ZMAN_MOMENTS = ["chaharit", "shema", "amida", "minha", "arvit", "slihot"] as const;
export type ZmanMoment = (typeof ZMAN_MOMENTS)[number];

export const isZmanMoment = (value: string): value is ZmanMoment =>
  (ZMAN_MOMENTS as readonly string[]).includes(value);

/** A landmark of the day, named in textReading.zman.marks. */
export type ZmanMarkKey =
  | "alot"
  | "misheyakir"
  | "netz"
  | "shemaMGA"
  | "shema"
  | "tefilaMGA"
  | "tefila"
  | "hatsot"
  | "minhaGuedola"
  | "minhaKetana"
  | "plag"
  | "chkia"
  | "tset"
  | "hatsotLayla";

export interface ZmanMark {
  key: ZmanMarkKey;
  date: Date;
}

export interface ZmanPlan {
  moment: ZmanMoment;
  /** Drawn on the night arc (sunset to sunrise) rather than the day's. */
  night: boolean;
  /** The arc: the day from sunrise to sunset, or the night from sunset to sunrise. */
  from: Date;
  to: Date;
  /** When the moment opens; before it, the pill says « à partir de ». */
  start: Date;
  /** When it closes. */
  end: Date;
  /** Arvit: said by preference before 'hatsot of the night, allowed until dawn. */
  preferred: Date | null;
  /** The landmarks, in the order of the day. */
  marks: ZmanMark[];
}

/**
 * Where the moment stands: not open yet, open (by preference, for Arvit
 * before 'hatsot), or closed.
 */
export type ZmanPhase = "before" | "preferred" | "during" | "after";

/** The day's times, by key; a time the place does not have is missing. */
function timesOf(place: ZmanimPlace, day: Date): Map<ZmanKey, Date> {
  return new Map(computeZmanim(place, day).map((zman) => [zman.key, zman.date]));
}

/** The landmarks of a moment: which time each one is, in the day's list. */
const DAY_MARKS: Record<
  "chaharit" | "shema" | "amida" | "minha",
  { start: ZmanKey; end: ZmanKey; marks: [ZmanMarkKey, ZmanKey][] }
> = {
  chaharit: {
    start: "misheyakir",
    end: "chatzot",
    marks: [
      ["misheyakir", "misheyakir"],
      ["netz", "sunrise"],
      ["tefila", "sofZmanTfilla"],
      ["hatsot", "chatzot"],
    ],
  },
  shema: {
    start: "misheyakir",
    end: "sofZmanShma",
    marks: [
      ["misheyakir", "misheyakir"],
      ["shemaMGA", "sofZmanShmaMGA"],
      ["shema", "sofZmanShma"],
    ],
  },
  amida: {
    start: "misheyakir",
    end: "sofZmanTfilla",
    marks: [
      ["netz", "sunrise"],
      ["tefilaMGA", "sofZmanTfillaMGA"],
      ["tefila", "sofZmanTfilla"],
      ["hatsot", "chatzot"],
    ],
  },
  minha: {
    start: "minchaGedola",
    end: "sunset",
    marks: [
      ["minhaGuedola", "minchaGedola"],
      ["minhaKetana", "minchaKetana"],
      ["plag", "plagHaMincha"],
      ["chkia", "sunset"],
    ],
  },
};

const byDate = (a: ZmanMark, b: ZmanMark) => a.date.getTime() - b.date.getTime();

/**
 * The plan of a moment for `now`, at `place`; null where the sun does not
 * give it (a polar day or night, an angle the sun does not reach).
 */
export function zmanPlan(moment: ZmanMoment, place: ZmanimPlace, now: Date): ZmanPlan | null {
  if (moment === "arvit") return arvitPlan(place, now);
  if (moment === "slihot") return slihotPlan(place, now);

  const def = DAY_MARKS[moment];
  const times = timesOf(place, now);
  const from = times.get("sunrise");
  const to = times.get("sunset");
  const start = times.get(def.start);
  const end = times.get(def.end);
  if (!from || !to || !start || !end) return null;
  const marks: ZmanMark[] = [];
  for (const [key, zman] of def.marks) {
    const date = times.get(zman);
    if (date) marks.push({ key, date });
  }
  return { moment, night: false, from, to, start, end, preferred: null, marks: marks.sort(byDate) };
}

/**
 * Arvit: from the stars to dawn, by preference before 'hatsot. Before dawn,
 * the night in progress is the one that began yesterday evening (the rule
 * of the night, services/nightBounds, the same as the home page's).
 */
function arvitPlan(place: ZmanimPlace, now: Date): ZmanPlan | null {
  const evening = liturgicalDay(place, now);
  const tonight = timesOf(place, evening);
  const morning = timesOf(place, placeDayAfter(place, evening, 1));
  const from = tonight.get("sunset");
  const start = tonight.get("tzeit");
  const preferred = tonight.get("chatzotNight") ?? null;
  const to = morning.get("sunrise");
  const end = nightEndOf(place, evening);
  if (!from || !start || !to || !end) return null;
  const marks: ZmanMark[] = [{ key: "tset", date: start }];
  if (preferred) marks.push({ key: "hatsotLayla", date: preferred });
  if (morning.get("alotHaShachar")) marks.push({ key: "alot", date: end });
  return { moment: "arvit", night: true, from, to, start, end, preferred, marks };
}

/** The Sli'hot: from 'hatsot of the night to sunrise, tonight or the next night. */
function slihotPlan(place: ZmanimPlace, now: Date): ZmanPlan | null {
  const window = slihotWindow(place, now);
  if (!window) return null;
  const evening = timesOf(place, placeDayAfter(place, window.end, -1));
  const morning = timesOf(place, window.end);
  const from = evening.get("sunset");
  if (!from) return null;
  const marks: ZmanMark[] = [{ key: "hatsotLayla", date: window.start }];
  const alot = morning.get("alotHaShachar");
  if (alot) marks.push({ key: "alot", date: alot });
  marks.push({ key: "netz", date: window.end });
  return {
    moment: "slihot",
    night: true,
    from,
    to: window.end,
    start: window.start,
    end: window.end,
    preferred: null,
    marks,
  };
}

export function zmanPhase(plan: ZmanPlan, now: Date): ZmanPhase {
  const t = now.getTime();
  if (t < plan.start.getTime()) return "before";
  if (t >= plan.end.getTime()) return "after";
  if (plan.preferred && t < plan.preferred.getTime()) return "preferred";
  return "during";
}

/**
 * The time the pill counts toward: the opening before it, the preferred
 * limit, then the closing.
 */
export function zmanTarget(plan: ZmanPlan, phase: ZmanPhase): Date {
  if (phase === "before") return plan.start;
  if (phase === "preferred" && plan.preferred) return plan.preferred;
  return plan.end;
}

/**
 * Where an instant falls on the arc: 0 at the left end (sunrise for the day,
 * sunset for the night), 1 at the right end. Outside, the sun is below the
 * horizon (by day) or above it (by night): misheyakir is a little under 0.
 */
export function arcPosition(plan: ZmanPlan, date: Date): number {
  const from = plan.from.getTime();
  return (date.getTime() - from) / (plan.to.getTime() - from);
}
