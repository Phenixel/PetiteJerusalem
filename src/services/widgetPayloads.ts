import textStudiesJson from "../datas/textStudies.json";
import type { TextStudiesJson, TextStudyJsonEntry } from "../models/models";
import { getTehilimOfDay, getWeeklyParasha } from "./dailyCycles";
import { computeZmanim, describeNearby, type ZmanimPlace } from "./zmanimService";
import type { UserPreferences } from "./userPreferencesService";

/**
 * Payloads des widgets d'écran d'accueil (Android / iOS).
 *
 * Les widgets natifs ne peuvent pas exécuter le code de la webview : l'app
 * pré-calcule ici tout ce qu'ils affichent (horaires à venir, lecture du jour)
 * et le leur transmet en JSON via le plugin PjWidgets (voir widgetService).
 * Tous les libellés sont localisés côté app : le natif ne fait qu'afficher.
 *
 * Le contrat est consommé par native/android/ (org.json) et native/ios/
 * (Codable) — toute évolution doit rester rétro-compatible ou incrémenter `v`.
 */

type Translate = (key: string, params?: Record<string, unknown>) => string;

/** Un horaire prêt à afficher : libellé localisé + instant en epoch ms. */
export interface ZmanimWidgetTime {
  key: string;
  label: string;
  epoch: number;
}

export interface ZmanimWidgetPayload {
  v: 1;
  updatedAt: number;
  title: string;
  /** Nom affichable du lieu ("Paris", "Près de Lyon"…). */
  place: string;
  /** Fuseau IANA du lieu : les heures s'affichent dedans, pas dans celui du téléphone. */
  tzid: string;
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

/**
 * Nom affichable du lieu — même logique que useZmanimPlaceLabel, qui vit dans
 * un composable (useI18n exige un setup de composant) et ne peut pas être
 * appelé d'un service.
 */
function placeLabel(place: ZmanimPlace, t: Translate, locale: string): string {
  if (place.city) return place.city;
  const naming = describeNearby(place.nearby);
  switch (naming.kind) {
    case "city":
      return naming.city;
    case "near":
      return t("zmanim.place.near", { city: naming.city });
    case "country":
      try {
        return (
          new Intl.DisplayNames([locale], { type: "region" }).of(naming.country) ??
          t("zmanim.place.device")
        );
      } catch {
        return t("zmanim.place.device");
      }
    default:
      return t("zmanim.place.device");
  }
}

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
        epoch: zman.date.getTime(),
      });
    }
  }
  times.sort((a, b) => a.epoch - b.epoch);
  return {
    v: 1,
    updatedAt: now.getTime(),
    title: t("zmanim.widget.title"),
    place: placeLabel(place, t, locale),
    tzid: place.tzid,
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
  updatedAt: number;
  title: string;
  /**
   * Jour civil local (YYYY-MM-DD) auquel les `done` se rapportent : passé
   * minuit, le natif repart de zéro sans attendre que l'app soit rouverte.
   */
  date: string;
  /** Faux tant que l'utilisateur n'a pas de liste (ou n'est pas connecté). */
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

/** Jour civil local (YYYY-MM-DD) — même règle que la page Lecture du jour. */
export function localDayKey(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
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
    updatedAt: now.getTime(),
    title: t("dailyReading.widget.title"),
    date,
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

  return { ...base, configured: items.length > 0, items, parasha, parashaDone };
}
