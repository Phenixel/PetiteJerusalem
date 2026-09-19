import { HDate, months } from "@hebcal/core";
import { localDayKey } from "./dateService";
import { omerDay } from "./dailyCycles";
import type { DailyHistory } from "./dailyHistory";
import { shiftDayKey } from "./dailyStreak";

/**
 * Les défis de saison : des fenêtres du calendrier hébraïque qui donnent une
 * raison de commencer à une date précise, avec leur propre compteur.
 *
 * - le 'Omer, 49 jours du 16 Nissan au 5 Sivan ;
 * - les Yamim Noraïm, 40 jours du 1er Eloul à Yom Kippour ;
 * - 'Hanouka, huit jours.
 *
 * Un défi démarre et s'arrête tout seul ; ce qu'il compte, ce sont les
 * journées réussies dans sa fenêtre, lues dans l'historique.
 */
export type ChallengeId = "omer" | "yamim-noraim" | "hanouka";

export interface Challenge {
  id: ChallengeId;
  /** Jour du défi (1..total). */
  day: number;
  total: number;
  /** Premier jour civil (YYYY-MM-DD). */
  start: string;
}

/** Le défi en cours au jour civil `date`, ou null hors saison. */
export function activeChallenge(date: Date = new Date()): Challenge | null {
  const hd = new HDate(date);
  const year = hd.getFullYear();
  const abs = hd.abs();

  const omer = omerDay(hd);
  if (omer !== null) {
    return {
      id: "omer",
      day: omer,
      total: 49,
      start: localDayKey(new HDate(16, months.NISAN, year).greg()),
    };
  }

  // Eloul appartient à l'année qui s'achève ; Tichri à celle qui commence.
  const eloulYear = hd.getMonth() === months.ELUL ? year : year - 1;
  const eloul = new HDate(1, months.ELUL, eloulYear).abs();
  const kippour = new HDate(10, months.TISHREI, eloulYear + 1).abs();
  if (abs >= eloul && abs <= kippour) {
    return {
      id: "yamim-noraim",
      day: abs - eloul + 1,
      total: kippour - eloul + 1,
      start: localDayKey(new HDate(eloul).greg()),
    };
  }

  const hanouka = new HDate(25, months.KISLEV, year).abs();
  if (abs >= hanouka && abs < hanouka + 8) {
    return {
      id: "hanouka",
      day: abs - hanouka + 1,
      total: 8,
      start: localDayKey(new HDate(hanouka).greg()),
    };
  }
  return null;
}

/** Journées réussies depuis le début du défi, aujourd'hui compris s'il l'est. */
export function challengeProgress(
  challenge: Challenge,
  history: DailyHistory,
  today: string,
  doneToday: boolean,
): number {
  let count = 0;
  for (let i = 0; i < challenge.day; i++) {
    const key = shiftDayKey(challenge.start, i);
    if (key === today) {
      if (doneToday) count += 1;
    } else if (history[key]?.ok) count += 1;
  }
  return count;
}
