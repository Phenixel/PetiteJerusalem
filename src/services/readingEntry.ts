/**
 * D'où vient la lecture : la propriété `entry` de `text_opened`.
 *
 * `source` ne disait que `library` ou `session`, si bien qu'une ouverture
 * depuis la recherche, une carte de l'accueil, la lecture du jour, un lien
 * profond ou l'office suivant se confondaient (voir
 * docs/audit-usage-posthog-2026-10.md, 5.3). `entry` se pose à côté, sans
 * rien retirer.
 *
 * Deux sources, dans cet ordre :
 *
 *  - un **indice** laissé juste avant la navigation par ce que la page
 *    précédente ne peut pas dire par son adresse : un résultat de recherche,
 *    « Reprendre ma lecture », une notification. Il ne vaut que quelques
 *    secondes, pour qu'un indice oublié ne colle pas à une lecture suivante ;
 *  - sinon, **la page d'où l'on vient** (`history.state.back` de vue-router) :
 *    l'accueil, la bibliothèque, la lecture du jour, un autre texte... Pas de
 *    page précédente : un lien ouvert de l'extérieur (widget, lien partagé,
 *    moteur de recherche) ou une page rechargée.
 *
 * Module pur, sans Vue ni routeur : la page de lecture lui passe ce qu'elle
 * sait, et les tests s'écrivent sans monter de composant.
 */

export type ReadingEntry =
  | "session"
  | "search"
  | "resume"
  | "push"
  | "home"
  | "library"
  | "daily_reading"
  | "chnei_mikra"
  | "tehilim_day"
  | "reading"
  | "zmanim"
  | "calendar"
  | "direct"
  | "other";

/** Ce que l'indice laissé avant la navigation peut valoir. */
export type ReadingEntryHint = Extract<ReadingEntry, "search" | "resume" | "push">;

/** Au-delà, l'indice ne parle plus de la lecture qui s'ouvre. */
export const READING_HINT_TTL_MS = 10_000;

let hint: { entry: ReadingEntryHint; at: number } | null = null;

/** Laissé par la page qui envoie vers un texte, juste avant d'y aller. */
export function markReadingEntry(entry: ReadingEntryHint, now = Date.now()): void {
  hint = { entry, at: now };
}

/** Les segments de section traduits (voir content/seoLocales.ts). */
const ZMANIM_SEGMENTS = new Set(["horaires", "shabbat-times", "zmanei-shabbat", "zmanim"]);
const CALENDAR_SEGMENTS = new Set(["calendrier", "holidays", "chagim"]);
const LOCALE_PREFIX = /^\/(en|he)(?=\/|$)/;

/** Ce que dit la page précédente, sans indice. */
export function readingEntryFromPath(backPath: string | null | undefined): ReadingEntry {
  if (typeof backPath !== "string" || backPath === "") return "direct";
  const path = backPath.split(/[?#]/)[0].replace(LOCALE_PREFIX, "") || "/";
  if (path === "/") return "home";
  const segments = path.split("/").filter(Boolean);
  const [first, second, third] = segments;
  if (first === "lire") return "reading";
  if (first === "share-reading" || first === "session-management") return "session";
  if (ZMANIM_SEGMENTS.has(first)) return "zmanim";
  if (CALENDAR_SEGMENTS.has(first)) return "calendar";
  if (first !== "bibliotheque") return "other";
  if (second === "lecture-du-jour") return "daily_reading";
  if (second === "chnei-mikra") return "chnei_mikra";
  if (second === "tehilim-du-jour") return "tehilim_day";
  // L'étagère ou la liste d'un rayon : la bibliothèque. Un chemin plus long
  // est un texte, d'où l'on passe à un autre (psaume suivant, office suivant).
  return third === undefined ? "library" : "reading";
}

/**
 * L'entrée de la lecture qui s'ouvre, et l'indice consommé au passage.
 * Une chaîne l'emporte sur tout : `source` le dit déjà, `entry` le répète.
 */
export function takeReadingEntry(
  backPath: string | null | undefined,
  options: { session: boolean; now?: number },
): ReadingEntry {
  const now = options.now ?? Date.now();
  const fresh = hint !== null && now - hint.at <= READING_HINT_TTL_MS ? hint.entry : null;
  hint = null;
  if (options.session) return "session";
  return fresh ?? readingEntryFromPath(backPath);
}
