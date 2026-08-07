import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { localDayKey } from "./dateService";
import { getTehilimOfDay, getWeeklyParasha } from "./dailyCycles";
import {
  computeZmanim,
  formatPlaceLabel,
  formatZmanTime,
  type ZmanimPlace,
} from "./zmanimService";
import type { UserPreferences } from "./userPreferencesService";

/**
 * Payloads des widgets d'écran d'accueil (Android / iOS).
 *
 * Les widgets natifs ne peuvent pas exécuter le code de la webview : l'app
 * pré-calcule ici tout ce qu'ils affichent (horaires à venir, lecture du jour)
 * et le leur transmet en JSON via le plugin PjWidgets (voir widgetService).
 * Tout ce qui se voit est produit ici, déjà localisé et déjà formaté — heures
 * comprises : le natif ne traduit rien, ne formate rien, ne calcule rien
 * (les DateFormatter natifs subissent réglage 12 h/24 h et calendrier de
 * l'appareil, qui casseraient l'affichage).
 *
 * Le contrat est consommé par native/android/ (org.json) et native/ios/
 * (Codable) — toute évolution doit rester rétro-compatible ou incrémenter `v`.
 */

type Translate = (key: string, params?: Record<string, unknown>) => string;

/** Un horaire prêt à afficher : libellé et heure localisés + epoch ms. */
export interface ZmanimWidgetTime {
  key: string;
  label: string;
  /** "17:42" dans le fuseau du lieu — le natif l'affiche tel quel. */
  time: string;
  /** Epoch ms : sert au natif à choisir le prochain horaire et à se replanifier. */
  epoch: number;
}

export interface ZmanimWidgetPayload {
  v: 1;
  title: string;
  /** Nom affichable du lieu ("Paris", "Près de Lyon"…). */
  place: string;
  /** Ligne "puis…" : gabarit localisé, {label}/{time} remplacés par le natif. */
  then: string;
  /** Message quand tous les horaires embarqués sont passés (app pas rouverte). */
  stale: string;
  /** Horaires triés, d'aujourd'hui à J+6 : le widget choisit le prochain. */
  times: ZmanimWidgetTime[];
}

/**
 * Nombre de jours d'horaires embarqués : le widget reste juste une semaine
 * sans que l'app soit rouverte, au-delà il affiche `stale`.
 */
export const ZMANIM_WIDGET_DAYS = 7;

export function buildZmanimWidgetPayload(
  place: ZmanimPlace,
  t: Translate,
  locale: string,
  now: Date = new Date(),
): ZmanimWidgetPayload {
  const times: ZmanimWidgetTime[] = [];
  for (let i = 0; i < ZMANIM_WIDGET_DAYS; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() + i);
    for (const zman of computeZmanim(place, day)) {
      times.push({
        key: zman.key,
        label: t(`zmanim.names.${zman.key}`),
        time: formatZmanTime(zman.date, place.tzid, locale),
        epoch: zman.date.getTime(),
      });
    }
  }
  times.sort((a, b) => a.epoch - b.epoch);
  return {
    v: 1,
    title: t("zmanim.widget.title"),
    place: formatPlaceLabel(place, t, locale),
    // Les {label}/{time} doivent survivre à la traduction : on les passe en
    // paramètres-sentinelles plutôt que de laisser vue-i18n les interpoler.
    then: t("zmanim.widget.then", { label: "{label}", time: "{time}" }),
    stale: t("zmanim.widget.stale"),
    times,
  };
}

/** Une entrée de la lecture du jour, avec son état "lu" du jour couvert. */
export interface DailyWidgetItem {
  key: string;
  label: string;
  done: boolean;
}

export interface DailyReadingWidgetPayload {
  v: 1;
  title: string;
  /** Jour civil local (YYYY-MM-DD) auquel les `done` se rapportent. */
  date: string;
  /**
   * Epoch ms du minuit local qui suit : passé cet instant, les `done` ne
   * comptent plus et le natif repart de zéro — comparaison numérique, aucune
   * logique de calendrier côté natif (le calendrier de l'appareil peut être
   * hébraïque, ce qui fausserait tout formatage de date natif).
   */
  expiresAt: number;
  /** Faux tant que l'utilisateur n'a rien activé (ou n'est pas connecté). */
  configured: boolean;
  /** Message affiché quand `configured` est faux. */
  emptyLabel: string;
  /** Message quand tout est lu. */
  allDoneLabel: string;
  /** Lectures du jour, dans l'ordre de la page (cycles en tête, puis la liste). */
  items: DailyWidgetItem[];
  /** Paracha de la semaine (chnei mikra), hors décompte quotidien. */
  parasha: string | null;
  parashaDone: boolean;
}

const allTexts = (textStudiesJson as TextStudiesJson).textStudies;
const textById = new Map<string, TextStudyJsonEntry>(allTexts.map((e) => [String(e.id), e]));

/** Epoch ms du prochain minuit local : l'échéance des coches du jour. */
function nextLocalMidnight(now: Date): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}

/**
 * La lecture du jour telle que le widget l'affichera. `prefs` vaut null quand
 * personne n'est connecté : le widget invite alors à ouvrir l'app.
 */
export function buildDailyReadingWidgetPayload(
  prefs: Pick<
    UserPreferences,
    "dailyReadingIds" | "dailyReadingOptions" | "dailyReadingProgress"
  > | null,
  t: Translate,
  now: Date = new Date(),
): DailyReadingWidgetPayload {
  const date = localDayKey(now);
  const base = {
    v: 1 as const,
    title: t("dailyReading.widget.title"),
    date,
    expiresAt: nextLocalMidnight(now),
    emptyLabel: t("dailyReading.widget.empty"),
    allDoneLabel: t("dailyReading.allReadTitle"),
  };
  if (!prefs) {
    return { ...base, configured: false, items: [], parasha: null, parashaDone: false };
  }

  const progress = prefs.dailyReadingProgress;
  // La progression d'un autre jour ne compte pas : le suivi est quotidien.
  const fresh = progress?.date === date;
  const doneIds = new Set(fresh ? (progress.completedIds ?? []).map(String) : []);
  const doneOptions = new Set(fresh ? (progress.completedOptions ?? []) : []);

  const items: DailyWidgetItem[] = [];
  if ((prefs.dailyReadingOptions ?? []).includes("tehilim-jour")) {
    const cycle = getTehilimOfDay(now);
    items.push({
      key: "tehilim-jour",
      label: t("dailyReading.options.tehilimDayReading", { day: cycle.day }),
      done: doneOptions.has("tehilim-jour"),
    });
  }
  for (const id of (prefs.dailyReadingIds ?? []).map(String)) {
    const entry = textById.get(id);
    if (entry) items.push({ key: id, label: entry.name, done: doneIds.has(id) });
  }

  // Chnei mikra : suivi hebdomadaire, affiché à part et hors décompte.
  let parasha: string | null = null;
  let parashaDone = false;
  if ((prefs.dailyReadingOptions ?? []).includes("parasha")) {
    const week = getWeeklyParasha(now);
    if (week) {
      // Libellé prêt à afficher ("Parachat Ekev") : le natif ne traduit rien.
      parasha = `${t("zmanim.shabbat.parasha")} ${week.entries.map((e) => e.name).join(" · ")}`;
      parashaDone =
        progress?.parashaProgress?.week === week.weekKey &&
        progress.parashaProgress.completed === true;
    }
  }

  // La paracha seule suffit à être « configuré » : un lecteur du chnei mikra
  // sans liste quotidienne ne doit pas être invité à « composer sa liste ».
  return {
    ...base,
    configured: items.length > 0 || parasha !== null,
    items,
    parasha,
    parashaDone,
  };
}
