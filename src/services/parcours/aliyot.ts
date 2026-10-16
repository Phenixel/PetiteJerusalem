import { addDays, weekdayOf, weekStart } from "./days";
import { isAlive } from "./model";
import type { CycleObjective, DayKey, DayLog, Objective, ParcoursData } from "./model";

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
 * Les montées se cochent aussi une à une, librement, sur la page du chnei
 * mikra (la liste de la semaine, et la case de chaque montée dans le texte),
 * avec ou sans objectif. Une coche s'écrit dans le journal du jour où on la
 * pose, parmi ce qui est fait (`done`), sous le nom « aliya:3 » (la 3e
 * montée de la semaine, comptée de 1) : une version d'avant, qui ne connaît
 * pas ce nom, l'ignore et le garde en réécrivant le jour. Les coches et les
 * cartes ne font qu'un : une carte cochée coche ses montées dans la liste, et
 * une carte dont toutes les montées sont cochées est faite.
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

/** Jusqu'où va la carte d'un jour : ses montées, et celles d'avant (le Chabbat, toutes). */
const cardEnd = (count: number, day: DayKey): number =>
  weekdayOf(day) >= STUDY_DAYS ? count : aliyotOfWeekday(count, weekdayOf(day)).to;

/**
 * La première montée qui compte dans la semaine d'un jour : 0, ou celles du
 * jour où l'on a commencé, pour une semaine commencée en route (`since`).
 */
export function aliyotFloor(since: DayKey, day: DayKey, count: number): number {
  return since > weekStart(day) ? aliyotOfWeekday(count, weekdayOf(since)).from : 0;
}

/** Le nom d'une coche dans le journal : « aliya:1 » pour la 1re montée de la semaine. */
const MARK_PREFIX = "aliya:";
export const aliyaMark = (aliya: number): string => `${MARK_PREFIX}${aliya + 1}`;

/** La montée d'une entrée du journal (comptée de 0), ou rien si ce n'est pas une coche. */
export function markedAliya(entry: string): number | null {
  if (!entry.startsWith(MARK_PREFIX)) return null;
  const n = Number(entry.slice(MARK_PREFIX.length));
  return Number.isInteger(n) && n >= 1 ? n - 1 : null;
}

/** Les jours de la semaine d'un jour, du dimanche au Chabbat (avant `before`, s'il est donné). */
export function aliyotWeekDays(day: DayKey, before?: DayKey): DayKey[] {
  const out: DayKey[] = [];
  let d = weekStart(day);
  for (let i = 0; i < 7; i++, d = addDays(d, 1)) {
    if (before !== undefined && d >= before) break;
    out.push(d);
  }
  return out;
}

/**
 * Les montées cochées dans la semaine d'un jour (comptées de 0), une à une
 * ou par la carte d'un jour : une carte cochée vaut pour ses montées et
 * celles d'avant. `objective` : le chnei mikra montée par montée, s'il y en
 * a un ; `before` : seulement ce qui a été coché avant ce jour.
 */
export function checkedAliyot(
  days: Record<DayKey, DayLog>,
  day: DayKey,
  count: number,
  objective?: Pick<Objective, "id" | "since"> | null,
  before?: DayKey,
): Set<number> {
  const checked = new Set<number>();
  const floor = objective ? aliyotFloor(objective.since, day, count) : 0;
  for (const d of aliyotWeekDays(day, before)) {
    for (const entry of days[d]?.done ?? []) {
      const aliya = markedAliya(entry);
      if (aliya !== null && aliya < count) checked.add(aliya);
      if (objective && entry === objective.id) {
        for (let m = floor; m < cardEnd(count, d); m++) checked.add(m);
      }
    }
  }
  return checked;
}

/**
 * Ce que la carte d'un jour demande : depuis la première montée pas encore
 * lue cette semaine (par une carte ou une à une) jusqu'à celles du jour.
 * Rien quand tout est déjà lu (en avance, ou le Chabbat d'une semaine finie).
 * Une semaine commencée en route (`since`) part des montées du jour où l'on
 * a commencé. Ce qui se coche le jour même ne déplace pas la carte : elle se
 * fait (voir `aliyotCardDone`).
 */
export function dueAliyot(
  objectiveId: string,
  day: DayKey,
  count: number,
  days: Record<DayKey, DayLog>,
  since: DayKey,
): AliyotRange | null {
  if (count <= 0) return null;
  const read = checkedAliyot(days, day, count, { id: objectiveId, since }, day);
  let from = aliyotFloor(since, day, count);
  while (read.has(from)) from++;
  const to = cardEnd(count, day);
  return from < to ? { from, to, count } : null;
}

/** La carte d'un jour est-elle faite par ses montées, cochées une à une jusqu'à ce jour ? */
export function aliyotCardDone(
  days: Record<DayKey, DayLog>,
  day: DayKey,
  range: { from: number; to: number },
): boolean {
  const checked = checkedAliyot(days, day, range.to, null, addDays(day, 1));
  for (let m = range.from; m < range.to; m++) if (!checked.has(m)) return false;
  return true;
}

/**
 * La semaine est-elle lue en entier ? Pour les champs d'avant Mon parcours
 * (`parashaProgress.completed`) : une carte cochée le vendredi ou le
 * Chabbat, qui couvrait les dernières montées, ou toutes les montées
 * cochées une à une (`count` : 7, ou 14 pour une paracha double).
 */
export function aliyotWeekDone(
  days: Record<DayKey, DayLog>,
  id: string,
  day: DayKey,
  count: number = ALIYOT_PER_PARASHA,
): boolean {
  // Le début de la semaine pour premier jour : une carte du vendredi vaut pour toutes.
  const read = checkedAliyot(days, day, count, { id, since: weekStart(day) }, addDays(day, 1));
  return read.size >= count;
}

/** Le chnei mikra montée par montée que l'on suit, s'il y en a un (le plus ancien). */
export function aliyotObjective(data: ParcoursData): CycleObjective | null {
  let found: CycleObjective | null = null;
  for (const objective of Object.values(data.objectives)) {
    if (objective.kind !== "cycle" || !isAlive(objective) || !readsByAliya(objective)) continue;
    if (!found || objective.createdAt < found.createdAt) found = objective;
  }
  return found;
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
