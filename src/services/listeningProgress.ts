import { ref } from "vue";

/**
 * Où l'on en est de chaque cours, sur cet appareil : la seconde atteinte, la
 * durée, l'heure de la dernière écoute, et s'il a été écouté jusqu'au bout.
 *
 * C'est ce qui permet de reprendre un cours là où on l'a laissé, de voir sur
 * une liste ce qui est entamé et ce qui est fini, et de proposer « Reprendre
 * l'écoute » en tête du catalogue. Une commodité de l'appareil, comme le
 * lecteur qui l'alimente : rien ne part vers un serveur, et un stockage vidé
 * (navigation privée, système qui fait de la place) ne perd qu'un confort.
 */

export interface Listening {
  /** Seconde atteinte. */
  t: number;
  /** Durée du cours, en secondes (0 si elle n'était pas connue). */
  d: number;
  /** Dernière écoute, en millisecondes depuis l'epoch. */
  at: number;
  /** Écouté jusqu'au bout (ou presque : voir FINISH_MARGIN). */
  done?: boolean;
}

const STORAGE_KEY = "pj:ecoute";
/** Au-delà, les plus anciennes écoutes s'oublient : la clé reste petite. */
const MAX_ENTRIES = 300;
/** Les dernières secondes d'un cours sont souvent des remerciements : fini. */
const FINISH_MARGIN = 30;
/** En deçà, on n'a fait qu'essayer : rien à reprendre. */
const MIN_RESUME = 15;

function read(): Record<string, Listening> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, Listening>) : {};
  } catch {
    return {};
  }
}

const state = ref<Record<string, Listening>>(read());

function persist(): void {
  const entries = Object.entries(state.value);
  if (entries.length > MAX_ENTRIES) {
    entries.sort((a, b) => b[1].at - a[1].at);
    state.value = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value));
  } catch {
    // Stockage plein ou refusé : l'écoute continue, seule la reprise se perd.
  }
}

/** Retient la position atteinte dans un cours. */
export function recordPosition(slug: string, seconds: number, duration: number): void {
  if (!slug || !Number.isFinite(seconds)) return;
  const d = Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0;
  const previous = state.value[slug];
  const done = d > 0 && seconds >= d - FINISH_MARGIN;
  state.value = {
    ...state.value,
    // Réécouter un cours fini ne lui retire pas sa coche avant la fin.
    [slug]: { t: Math.round(seconds), d, at: Date.now(), done: done || previous?.done === true },
  };
  persist();
}

/** Le cours a été écouté jusqu'au bout. */
export function recordFinished(slug: string, duration: number): void {
  recordPosition(slug, duration, duration);
  const entry = state.value[slug];
  if (entry && !entry.done) {
    state.value = { ...state.value, [slug]: { ...entry, done: true } };
    persist();
  }
}

export function listeningOf(slug: string): Listening | null {
  return state.value[slug] ?? null;
}

/**
 * La seconde où reprendre un cours, ou null s'il n'y a rien à reprendre (pas
 * entamé, juste essayé, ou mené à sa fin : on le réécoute alors du début).
 * On recule de quelques secondes pour retrouver le fil de la phrase.
 */
export function resumePosition(slug: string): number | null {
  const entry = state.value[slug];
  if (!entry || entry.t < MIN_RESUME) return null;
  if (entry.d > 0 && entry.t >= entry.d - FINISH_MARGIN) return null;
  return Math.max(0, entry.t - 3);
}

/**
 * L'avancement d'un cours, de 0 à 1, pour la barre d'une ligne ; 1 s'il est
 * fini, 0 s'il n'est pas entamé ou que sa durée est inconnue.
 */
export function progressOf(slug: string): number {
  const entry = state.value[slug];
  if (!entry) return 0;
  if (entry.done && entry.t >= entry.d - FINISH_MARGIN) return 1;
  if (!entry.d) return 0;
  return Math.min(1, entry.t / entry.d);
}

export function isFinished(slug: string): boolean {
  return state.value[slug]?.done === true;
}

/** Les cours entamés et pas finis, du plus récemment écouté au plus ancien. */
export function inProgressSlugs(): string[] {
  return Object.entries(state.value)
    .filter(([slug]) => resumePosition(slug) !== null)
    .sort((a, b) => b[1].at - a[1].at)
    .map(([slug]) => slug);
}

/** Pour les tests : relit le stockage. */
export function reloadListening(): void {
  state.value = read();
}
