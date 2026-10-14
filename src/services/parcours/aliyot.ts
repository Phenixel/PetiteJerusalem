import { addDays, weekdayOf, weekStart } from "./days";
import type { DayKey, DayLog, Objective } from "./model";

/**
 * Le chnei mikra, une montée par jour (le cycle de la paracha, `split:
 * "aliyot"`) : les sept montées de la paracha se lisent du dimanche au
 * vendredi, une par jour, la sixième et la septième le vendredi. Une paracha
 * double en a quatorze, réparties de même sur les six jours.
 *
 * Une montée oubliée reste due : le lendemain, la carte en montre deux
 * (« 2e et 3e montées »), et ce qui reste le vendredi se lit encore le
 * Chabbat. Cocher la carte d'un jour vaut pour tout ce qu'elle montrait.
 *
 * Les montées se comptent de 0 sur la semaine, d'une paracha à l'autre pour
 * une double (0 à 6 la première, 7 à 13 la seconde) ; une plage est `from`
 * compris, `to` exclu.
 */

/** Les montées d'une paracha : toutes les parachiot du Pentateuque en ont sept. */
export const ALIYOT_PER_PARASHA = 7;

/** Les jours d'étude : du dimanche (0) au vendredi (5). */
const STUDY_DAYS = 6;

/** Ce qu'une carte demande : de quelle montée à quelle montée, sur combien dans la semaine. */
export interface AliyotRange {
  from: number;
  to: number;
  count: number;
}

/** Le chnei mikra d'un objectif se lit-il montée par montée ? */
export const readsByAliya = (objective: Objective): boolean =>
  objective.kind === "cycle" && objective.cycle === "parasha" && objective.split === "aliyot";

/** Les montées d'un jour de la semaine (0 dimanche) ; le Chabbat n'en ajoute pas. */
export function aliyotOfWeekday(count: number, weekday: number): { from: number; to: number } {
  if (weekday >= STUDY_DAYS) return { from: count, to: count };
  return {
    from: Math.floor((weekday * count) / STUDY_DAYS),
    to: Math.floor(((weekday + 1) * count) / STUDY_DAYS),
  };
}

/**
 * Ce que la carte d'un jour demande : depuis la première montée pas encore
 * lue cette semaine jusqu'à celles du jour. Rien quand tout est déjà lu (en
 * avance, ou le Chabbat d'une semaine finie). Une semaine commencée en
 * route (`since`) part des montées du jour où l'on a commencé.
 */
export function dueAliyot(
  objectiveId: string,
  day: DayKey,
  count: number,
  days: Record<DayKey, DayLog>,
  since: DayKey,
): AliyotRange | null {
  if (count <= 0) return null;
  const start = weekStart(day);
  let read = since > start ? aliyotOfWeekday(count, weekdayOf(since)).from : 0;
  for (let d = start; d < day; d = addDays(d, 1)) {
    if (days[d]?.done.includes(objectiveId)) {
      read = Math.max(read, aliyotOfWeekday(count, weekdayOf(d)).to);
    }
  }
  const to = weekdayOf(day) >= STUDY_DAYS ? count : aliyotOfWeekday(count, weekdayOf(day)).to;
  return read < to ? { from: read, to, count } : null;
}

/**
 * La semaine est-elle lue en entier ? Pour les champs d'avant Mon parcours
 * (`parashaProgress.completed`) : une carte cochée le vendredi ou le
 * Chabbat, qui couvrait les dernières montées.
 */
export function aliyotWeekDone(days: Record<DayKey, DayLog>, id: string, day: DayKey): boolean {
  for (let d = weekStart(day); d <= day; d = addDays(d, 1)) {
    if (weekdayOf(d) >= STUDY_DAYS - 1 && days[d]?.done.includes(id)) return true;
  }
  return false;
}

/** De quoi écrire un libellé : la fonction de traduction de vue-i18n. */
type Translate = (key: string, named?: Record<string, unknown>) => string;

/**
 * Les montées d'une plage, en clair : « Berechit, 2e et 3e montées » ; pour
 * une paracha double, chacune avec les siennes (« Vayakhel, 7e montée ·
 * Pekoudei, 1re et 2e montées »). `names` : les parachiot de la semaine.
 */
export function aliyotLabel(range: { from: number; to: number }, names: string[], t: Translate) {
  const ordinal = (n: number) => t(`parcours.aliyot.ordinals.n${n}`);
  const parts: string[] = [];
  for (let m = range.from; m < range.to; ) {
    const entry = Math.floor(m / ALIYOT_PER_PARASHA);
    const end = Math.min(range.to, (entry + 1) * ALIYOT_PER_PARASHA);
    const a = (m % ALIYOT_PER_PARASHA) + 1;
    const b = ((end - 1) % ALIYOT_PER_PARASHA) + 1;
    const text =
      a === b
        ? t("parcours.aliyot.one", { n: ordinal(a) })
        : b === a + 1
          ? t("parcours.aliyot.two", { a: ordinal(a), b: ordinal(b) })
          : t("parcours.aliyot.range", { a: ordinal(a), b: ordinal(b) });
    parts.push(names[entry] ? `${names[entry]}, ${text}` : text);
    m = end;
  }
  return parts.join(" · ");
}

/** `?montees=2-3` (comptées de 1, la page du chnei mikra) : la plage, ou rien. */
export function parseAliyotQuery(value: unknown): { from: number; to: number } | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(value);
  if (!match) return null;
  const from = Number(match[1]) - 1;
  const to = Number(match[2]);
  return from >= 0 && to > from ? { from, to } : null;
}

