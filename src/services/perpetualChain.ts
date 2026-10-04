import type { PrayerName, PrayerNameGender, PrayerNameKind, Session } from "../models/models";

/**
 * La chaîne perpétuelle de Tehilim : ce qui se calcule sans réseau ni
 * calendrier hébraïque (voir docs/chaine-perpetuelle.md). Les écritures
 * passent par prayerNameService ; la remise à zéro d'un tour fini, par la
 * Cloud Function onPerpetualSessionUpdated.
 */

/** Jours pendant lesquels un nom sans date est lu ; on le prolonge d'autant. */
export const PRAYER_NAME_TTL_DAYS = 30;

/**
 * Un nom de défunt avec la date de son décès paraît la semaine qui précède
 * l'anniversaire, jusqu'au jour même : la même fenêtre que l'accueil pour les
 * dates du calendrier (UPCOMING_HORIZON_DAYS).
 */
export const ANNIVERSARY_WINDOW_DAYS = 7;

/** Noms qu'un même compte tient dans la liste : au-delà, la liste serait la sienne. */
export const MAX_NAMES_PER_OWNER = 10;

/** Longueur d'un prénom, la même que dans les règles Firestore. */
export const PRAYER_NAME_MAX_LENGTH = 40;

const DAY_MS = 24 * 3600 * 1000;

/** Ce qu'on saisit dans la fenêtre « Proposer un nom ». */
export interface PrayerNameInput {
  gender: PrayerNameGender;
  firstName: string;
  motherName: string;
  kind: PrayerNameKind;
  /** Date hébraïque du décès, leilouy nichmat seulement ; null sans date. */
  deathDay: number | null;
  deathMonth: number | null;
}

export function isPerpetual(session: Pick<Session, "perpetual"> | null | undefined): boolean {
  return session?.perpetual === true;
}

/** La chaîne perpétuelle parmi les sessions, si elle est ouverte au public. */
export function findPerpetualSession(sessions: Session[]): Session | null {
  return sessions.find((s) => isPerpetual(s) && s.hidden !== true) ?? null;
}

export function connectorOf(gender: PrayerNameGender): "ben" | "bat" {
  return gender === "female" ? "bat" : "ben";
}

/** « David ben Sarah », « Rivka bat Léa » : le nom tel qu'on le dit. */
export function formatPrayerName(
  name: Pick<PrayerName, "gender" | "firstName" | "motherName">,
): string {
  return `${name.firstName} ${connectorOf(name.gender)} ${name.motherName}`;
}

/** Un prénom saisi : sans espaces autour, ni deux espaces de suite. */
export function normalizeNamePart(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** Un leilouy nichmat qui porte la date du décès revient chaque année. */
export function isDated(
  name: Pick<PrayerName, "kind" | "deathDay" | "deathMonth"> | PrayerNameInput,
): boolean {
  return name.kind === "leilouy" && !!name.deathDay && !!name.deathMonth;
}

/** L'échéance d'un nom sans date, posé ou prolongé maintenant. */
export function prayerNameExpiry(now: Date): Date {
  return new Date(now.getTime() + PRAYER_NAME_TTL_DAYS * DAY_MS);
}

/**
 * Le nom est-il lu aujourd'hui ? Un nom daté l'est dans sa fenêtre :
 * `daysUntilAnniversary` (0 le jour même) vient du calendrier hébraïque,
 * calculé par prayerNameService. Un nom sans date l'est jusqu'à son échéance.
 */
export function isPrayerNameListed(
  name: PrayerName,
  now: Date,
  daysUntilAnniversary: number | null,
): boolean {
  if (isDated(name)) {
    return daysUntilAnniversary !== null && daysUntilAnniversary <= ANNIVERSARY_WINDOW_DAYS;
  }
  return name.expiresAt !== null && name.expiresAt.getTime() > now.getTime();
}

/** Jours avant l'échéance d'un nom sans date (arrondi supérieur, 0 s'il est passé). */
export function daysBeforeExpiry(name: PrayerName, now: Date): number {
  if (!name.expiresAt) return 0;
  return Math.max(0, Math.ceil((name.expiresAt.getTime() - now.getTime()) / DAY_MS));
}

/**
 * L'ordre de la liste : les noms du lecteur d'abord (ce sont eux qu'il vient
 * retrouver), puis du plus ancien au plus récent, pour qu'un nom ne change
 * pas de place d'une visite à l'autre.
 */
export function sortPrayerNames(names: PrayerName[], ownerId: string | null): PrayerName[] {
  return [...names].sort((a, b) => {
    const mineA = a.ownerId === ownerId ? 0 : 1;
    const mineB = b.ownerId === ownerId ? 0 : 1;
    return mineA - mineB || a.createdAt.getTime() - b.createdAt.getTime();
  });
}

/** Une durée telle qu'on la dit : en heures sous un jour, en jours au-delà. */
export interface SpokenDuration {
  unit: "hours" | "days";
  value: number;
}

export function spokenDuration(ms: number): SpokenDuration {
  if (ms < DAY_MS) return { unit: "hours", value: Math.max(1, Math.round(ms / 3_600_000)) };
  return { unit: "days", value: Math.round(ms / DAY_MS) };
}

/** Le compteur de la chaîne, tel que la page l'affiche. */
export interface PerpetualStats {
  /** Le tour en cours, à partir de 1. */
  cycle: number;
  completedCycles: number;
  /** Tehilim lus depuis l'ouverture, tour en cours compris. */
  totalRead: number;
  /** Durée moyenne d'un tour terminé, null avant le premier. */
  averageCycle: SpokenDuration | null;
  /** Durée du dernier tour terminé, null avant le premier. */
  lastCycle: SpokenDuration | null;
  lastCycleEndedAt: Date | null;
  lastCycleParticipants: number | null;
}

/**
 * `currentRead` : les places lues du tour en cours, comptées comme la barre
 * d'avancement (getSessionReservationStats).
 */
export function perpetualStats(session: Session, currentRead: number): PerpetualStats {
  const completedCycles = session.completedCycles ?? 0;
  const slotCount = session.slotCount ?? 0;
  const ended = session.lastCycleEndedAt ?? null;
  const started = session.lastCycleStartedAt ?? null;

  const opened = session.createdAt instanceof Date ? session.createdAt : null;
  const averageCycle =
    completedCycles > 0 && ended && opened
      ? spokenDuration((ended.getTime() - opened.getTime()) / completedCycles)
      : null;
  const lastCycle = ended && started ? spokenDuration(ended.getTime() - started.getTime()) : null;

  return {
    cycle: session.cycle ?? completedCycles + 1,
    completedCycles,
    totalRead: completedCycles * slotCount + currentRead,
    averageCycle,
    lastCycle,
    lastCycleEndedAt: ended,
    lastCycleParticipants: session.lastCycleParticipants ?? null,
  };
}

/**
 * Le tour est-il entièrement lu ? La même règle que la Cloud Function
 * (isRoundComplete, functions/src/perpetualRound.ts) : chaque place a une
 * réservation lue, une place étant un texte. Sans `slotCount` valide, jamais :
 * la fonction ne remettrait pas la chaîne à zéro, inutile de l'attendre.
 */
export function isRoundFinished(session: Pick<Session, "reservations" | "slotCount">): boolean {
  const slotCount = session.slotCount;
  if (typeof slotCount !== "number" || !Number.isInteger(slotCount) || slotCount <= 0) {
    return false;
  }
  const read = new Set<string>();
  for (const r of session.reservations ?? []) {
    if (r?.isCompleted === true) read.add(r.textStudyId);
  }
  return read.size >= slotCount;
}

/**
 * Les attentes entre deux relectures de la chaîne, une fois le tour lu. La
 * Cloud Function la remet à zéro dans la seconde, mais un démarrage à froid
 * peut prendre plusieurs secondes : on relit vite, puis de plus en plus
 * espacé, une quarantaine de secondes en tout, et pas au-delà.
 */
export const NEXT_ROUND_RETRY_DELAYS_MS: readonly number[] = [1500, 3000, 5000, 10_000, 20_000];

/** La chaîne relue a-t-elle quitté le tour que l'on voyait fini ? */
export function hasNextRoundStarted(
  previous: Pick<Session, "cycle">,
  latest: Pick<Session, "cycle" | "reservations" | "slotCount">,
): boolean {
  return (latest.cycle ?? 0) > (previous.cycle ?? 0) || !isRoundFinished(latest);
}

export interface WaitForNextRoundOptions {
  /** Attentes avant chaque relecture ; par défaut NEXT_ROUND_RETRY_DELAYS_MS. */
  delays?: readonly number[];
  /** Coupe l'attente (page quittée) : plus aucune relecture ne part. */
  signal?: AbortSignal;
}

function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

/**
 * Relit la chaîne jusqu'à voir le tour suivant, par quelques essais espacés et
 * bornés (`delays`). Renvoie la chaîne relue, ou null si le tour suivant
 * n'est pas venu à temps, ou si l'attente a été coupée. Une relecture qui
 * échoue (réseau) compte pour un essai, sans interrompre les suivants.
 */
export async function waitForNextRound(
  previous: Pick<Session, "cycle">,
  load: () => Promise<Session | null>,
  { delays = NEXT_ROUND_RETRY_DELAYS_MS, signal }: WaitForNextRoundOptions = {},
): Promise<Session | null> {
  for (const delay of delays) {
    await pause(delay, signal);
    if (signal?.aborted) return null;
    let latest: Session | null = null;
    try {
      latest = await load();
    } catch (err) {
      console.error("Relecture de la chaîne impossible :", err);
    }
    if (signal?.aborted) return null;
    if (latest && hasNextRoundStarted(previous, latest)) return latest;
  }
  return null;
}
