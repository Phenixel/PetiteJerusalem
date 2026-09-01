import { getTehilimOfDay } from "./dailyCycles";
import { localDayKey } from "./dateService";

/**
 * Payload de la montre (Wear OS / Apple Watch).
 *
 * La montre reçoit d'abord les deux payloads des widgets, tels quels : les
 * horaires (`zmanim`) et la lecture du jour (`daily`) de widgetPayloads.ts.
 * Ils sont déjà exactement ce qu'un écran de montre demande, déjà localisés et
 * déjà formatés ; les recalculer autrement ne ferait que deux contrats à
 * tenir au lieu d'un.
 *
 * Ce fichier ne porte donc que ce que les widgets n'ont pas : les libellés des
 * écrans de la montre, et les Tehilim du jour. Le texte des psaumes, lui, ne
 * voyage pas : les 150 chapitres sont embarqués dans l'app de montre
 * elle-même (public/texts/tehilim.json, recopié par les scripts de setup),
 * pour qu'ils se lisent sans téléphone à portée et sans rien attendre.
 *
 * Le contrat est consommé par native/wear/ (org.json) et native/watchos/
 * (Codable), toute évolution doit rester rétro-compatible ou incrémenter `v`.
 */

type Translate = (key: string, params?: Record<string, unknown>) => string;

/** Les psaumes du jour, tête de la liste des Tehilim sur la montre. */
export interface WatchTehilimDay {
  /** « Tehilim du jour », déjà localisé. */
  label: string;
  /** Numéros des psaumes du jour (1..150), dans l'ordre de lecture. */
  psalms: number[];
}

export interface WatchPayload {
  v: 1;
  /**
   * Langue de l'interface ("fr", "en", "he") : la montre y lit le sens de son
   * interface, les textes hébreux restant de droite à gauche quoi qu'il
   * arrive.
   */
  locale: string;
  /** Accent du thème de l'utilisateur, comme pour les widgets. */
  accent: string;
  /** Titres des trois écrans, dans l'ordre du menu. */
  zmanimTitle: string;
  dailyTitle: string;
  textsTitle: string;
  /** Titre de la liste des psaumes. */
  tehilimTitle: string;
  /**
   * Gabarit du titre d'un psaume, avec son `{n}` intact : le numéro se compte
   * côté natif, qui seul sait lequel est affiché.
   */
  psalmTemplate: string;
  /** Les psaumes du jour, mis en tête de la liste. */
  tehilimOfDay: WatchTehilimDay;
  /**
   * Epoch ms du minuit local qui suit : passé cet instant, les psaumes du jour
   * ne sont plus ceux du jour et la montre cesse de les mettre en avant.
   * Comparaison numérique, aucune logique de calendrier côté natif.
   */
  expiresAt: number;
  /** Message tant que le téléphone n'a rien envoyé (montre fraîchement posée). */
  pairing: string;
}

/** Epoch ms du prochain minuit local : l'échéance des psaumes du jour. */
function nextLocalMidnight(now: Date): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}

/**
 * Le jour civil auquel se rapportent les psaumes du jour. Exporté pour les
 * tests : c'est la même journée que celle de la lecture du jour.
 */
export function watchDayKey(now: Date = new Date()): string {
  return localDayKey(now);
}

export function buildWatchPayload(
  t: Translate,
  locale: string,
  now: Date = new Date(),
  accent: string,
): WatchPayload {
  const cycle = getTehilimOfDay(now);
  return {
    v: 1,
    locale,
    accent,
    zmanimTitle: t("watch.zmanim"),
    dailyTitle: t("watch.daily"),
    textsTitle: t("watch.texts"),
    tehilimTitle: t("watch.tehilim"),
    // Le {n} doit survivre à la traduction : sentinelle passée en paramètre
    // plutôt que laissée à l'interpolation de vue-i18n, comme le « puis… »
    // des horaires.
    psalmTemplate: t("watch.psalm", { n: "{n}" }),
    tehilimOfDay: {
      label: t("watch.tehilimOfDay"),
      psalms: cycle.psalms,
    },
    expiresAt: nextLocalMidnight(now),
    pairing: t("watch.pairing"),
  };
}
