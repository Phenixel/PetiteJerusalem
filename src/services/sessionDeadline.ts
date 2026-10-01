import { endOfLocalDay } from "./dateService";

/**
 * Une date limite si proche qu'on demande confirmation avant de créer la
 * chaîne.
 *
 * En septembre 2026, trois chaînes sur neuf avaient pour date limite le jour
 * même de leur création ; deux sont restées vides. Une chaîne de 150 psaumes
 * se remplit rarement en une soirée, mais certaines doivent tenir en un jour
 * (une veillée, une refoua chelema urgente) : on ne l'interdit pas, on
 * demande si c'est bien voulu (voir docs/design.md, « Une chaîne courte se
 * confirme »).
 */

/** Ce soir ou demain soir : en deçà, la confirmation est demandée. */
export const SHORT_DEADLINE_DAYS = 2;

const DAY_MS = 24 * 3600 * 1000;

/**
 * Le nombre de jours jusqu'à la fin de la date limite, arrondi au jour
 * supérieur : 1 pour aujourd'hui, 2 pour demain. Le même calcul que la
 * propriété `deadline_days` de `session_created`.
 */
export function deadlineDays(dateKey: string, now = Date.now()): number {
  return Math.ceil((endOfLocalDay(dateKey).getTime() - now) / DAY_MS);
}

/** La date limite tombe-t-elle ce soir ou demain soir ? */
export function isShortDeadline(dateKey: string, now = Date.now()): boolean {
  if (!dateKey) return false;
  return deadlineDays(dateKey, now) <= SHORT_DEADLINE_DAYS;
}
