import type { IconName } from "../components/icons/registry";

/**
 * Les widgets de l'accueil connecté : ce que chacun y veut voir, dans l'ordre
 * où il veut le voir.
 *
 * Le choix vit dans les préférences du compte (`homeWidgets`, une liste
 * ordonnée de clés), il suit donc la personne d'un appareil à l'autre. Tant
 * qu'elle n'y a pas touché, le champ est absent et l'accueil garde sa
 * composition d'origine (DEFAULT_HOME_WIDGETS), qui peut évoluer avec les
 * versions ; dès qu'elle l'a réglé, c'est sa liste qui fait foi, et un widget
 * ajouté plus tard ne s'y invite pas : il attend dans « À ajouter ».
 *
 * Compatibilité : une app installée peut lire une liste écrite par une
 * version plus récente. Une clé qu'elle ne connaît pas est ignorée à
 * l'affichage, mais jamais effacée à l'enregistrement (voir
 * homeWidgetsToSave) : la version récente la retrouvera à sa place.
 */

export const HOME_WIDGET_KEYS = [
  "daily_reading",
  "zmanim",
  "resume_reading",
  "month",
  "today",
  "next_holiday",
  "tehilim_day",
  "parasha",
  "daf_yomi",
] as const;

export type HomeWidgetKey = (typeof HOME_WIDGET_KEYS)[number];

/** L'accueil de qui n'a rien réglé : celui d'avant les widgets. */
export const DEFAULT_HOME_WIDGETS: readonly HomeWidgetKey[] = ["daily_reading", "zmanim"];

/** Borne de la liste enregistrée ; la règle Firestore en garde une plus large. */
export const MAX_HOME_WIDGETS = 20;

/** Le dessin de chaque widget, dans l'éditeur (le widget porte le sien). */
export const HOME_WIDGET_ICONS: Record<HomeWidgetKey, IconName> = {
  daily_reading: "book",
  zmanim: "clock",
  resume_reading: "bookmark",
  month: "calendar",
  today: "sunrise",
  next_holiday: "candle",
  tehilim_day: "book-open",
  parasha: "scroll",
  daf_yomi: "graduation-cap",
};

export function isHomeWidgetKey(key: unknown): key is HomeWidgetKey {
  return typeof key === "string" && (HOME_WIDGET_KEYS as readonly string[]).includes(key);
}

/**
 * Les widgets à afficher, dans l'ordre : la liste du compte, sans les clés
 * inconnues ni les doublons ; la composition d'origine quand rien n'a été
 * réglé (champ absent ou illisible). Une liste vide est un choix : l'accueil
 * n'a alors plus de widgets.
 */
export function resolveHomeWidgets(stored: unknown): HomeWidgetKey[] {
  if (!Array.isArray(stored)) return [...DEFAULT_HOME_WIDGETS];
  return [...new Set(stored.filter(isHomeWidgetKey))];
}

/** Ceux qu'on peut encore ajouter, dans l'ordre du catalogue. */
export function availableHomeWidgets(shown: readonly HomeWidgetKey[]): HomeWidgetKey[] {
  return HOME_WIDGET_KEYS.filter((key) => !shown.includes(key));
}

/**
 * La liste à enregistrer : l'ordre choisi, suivi des clés que cette version
 * ne connaît pas et que la liste du compte portait (écrites par une version
 * plus récente). Les effacer ferait perdre un réglage à qui a aussi l'app à
 * jour sur un autre appareil.
 */
export function homeWidgetsToSave(shown: readonly HomeWidgetKey[], stored: unknown): string[] {
  const unknown = Array.isArray(stored)
    ? stored.filter((key): key is string => typeof key === "string" && !isHomeWidgetKey(key))
    : [];
  return [...new Set([...shown, ...unknown])].slice(0, MAX_HOME_WIDGETS);
}

/** Déplace un widget d'un cran (-1 : plus haut, +1 : plus bas) ; sans effet au bord. */
export function moveHomeWidget(
  list: readonly HomeWidgetKey[],
  index: number,
  delta: -1 | 1,
): HomeWidgetKey[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return [...list];
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Deux listes identiques, dans le même ordre : rien à enregistrer. */
export function sameHomeWidgets(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, i) => key === b[i]);
}
