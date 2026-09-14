import { devicePreference } from "./devicePreference";
import { localDayKey } from "./dateService";

/**
 * La relance du formulaire de support : une petite carte, en bas de l'accueil,
 * qui demande si tout se passe bien à qui a déjà un peu utilisé l'app.
 *
 * « Un peu utilisé » se mesure en jours distincts d'ouverture, retenus sur
 * l'appareil (comme le passage de l'introduction) : trois ouvertures le même
 * soir ne disent rien, trois jours différents, si. On ne garde que les
 * derniers jours, le compte n'a pas besoin de remonter plus loin.
 *
 * La relance se propose au plus quelques fois, à une semaine d'écart, et se
 * tait pour de bon dès qu'on lui a répondu, dans un sens ou dans l'autre.
 * Ce module ne décide pas QUAND l'afficher (accueil seulement, rien d'ouvert
 * par-dessus, pas d'écoute en cours) : c'est le composant qui tient ces
 * conditions, ici seulement la mémoire et la règle.
 */

/** Jours distincts d'utilisation avant de proposer la relance. */
export const USAGE_DAYS_REQUIRED = 3;
/** Au-delà, on n'insiste plus, même sans réponse. */
export const NUDGE_MAX_SHOWS = 3;
/** Entre deux propositions restées sans réponse. */
export const NUDGE_RETRY_DAYS = 7;
/** Les jours retenus : assez pour compter, pas de quoi tracer. */
const USAGE_DAYS_KEPT = 10;

export interface FeedbackNudgeState {
  /** Nombre de fois où la carte s'est affichée. */
  shows: number;
  /** Dernier affichage (ISO), ou null si jamais. */
  lastShownAt: string | null;
  /** La personne a répondu (« Tout va bien » ou le formulaire ouvert). */
  answered: boolean;
}

function parseDays(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((d) => typeof d === "string") ? parsed : null;
  } catch {
    return null;
  }
}

function parseState(raw: string | null): FeedbackNudgeState | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as Record<string, unknown>;
    return {
      shows: typeof p.shows === "number" && p.shows >= 0 ? p.shows : 0,
      lastShownAt: typeof p.lastShownAt === "string" ? p.lastShownAt : null,
      answered: p.answered === true,
    };
  } catch {
    return null;
  }
}

const usageDays = devicePreference<string[]>("pj_usage_days", parseDays, JSON.stringify);
const nudgeState = devicePreference<FeedbackNudgeState>(
  "pj_feedback_nudge",
  parseState,
  JSON.stringify,
);

/** Note l'ouverture du jour ; renvoie le nombre de jours distincts retenus. */
export function recordUsageDay(today: string = localDayKey()): number {
  const days = usageDays.read() ?? [];
  if (days.includes(today)) return days.length;
  const next = [...days, today].slice(-USAGE_DAYS_KEPT);
  usageDays.write(next);
  return next.length;
}

/** Jours distincts d'utilisation connus de l'appareil. */
export function usageDayCount(): number {
  return usageDays.read()?.length ?? 0;
}

export function readNudgeState(): FeedbackNudgeState | null {
  return nudgeState.read();
}

/**
 * La règle : assez de jours d'usage, pas encore de réponse, pas trop de
 * propositions déjà faites, et au moins une semaine depuis la dernière.
 */
export function shouldOfferFeedbackNudge(input: {
  usageDays: number;
  state: FeedbackNudgeState | null;
  now: Date;
}): boolean {
  if (input.usageDays < USAGE_DAYS_REQUIRED) return false;
  const state = input.state;
  if (!state) return true;
  if (state.answered || state.shows >= NUDGE_MAX_SHOWS) return false;
  if (!state.lastShownAt) return true;
  const last = new Date(state.lastShownAt).getTime();
  if (Number.isNaN(last)) return true;
  return input.now.getTime() - last >= NUDGE_RETRY_DAYS * 24 * 60 * 60 * 1000;
}

export function markNudgeShown(now: Date = new Date()): void {
  const state = nudgeState.read();
  nudgeState.write({
    shows: (state?.shows ?? 0) + 1,
    lastShownAt: now.toISOString(),
    answered: state?.answered ?? false,
  });
}

export function markNudgeAnswered(): void {
  const state = nudgeState.read();
  nudgeState.write({
    shows: state?.shows ?? 1,
    lastShownAt: state?.lastShownAt ?? new Date().toISOString(),
    answered: true,
  });
}

/**
 * Au premier lancement de l'app native, le localStorage peut avoir été vidé :
 * les préférences natives rendent les jours et l'état de la relance.
 */
export async function restoreFeedbackNudge(): Promise<void> {
  await Promise.all([usageDays.restore(), nudgeState.restore()]);
}
