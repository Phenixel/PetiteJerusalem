import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { TefilaStep } from "../services/parcours/schedule";
import { currentTefilaWindow, tefilaWindowsOfDay } from "../services/sidourService";
import { formatZmanTime } from "../services/zmanimService";
import { useNow } from "./useNow";
import { useZmanimLocation } from "./useZmanimLocation";

/**
 * L'heure des trois offices, pour Mon parcours : celui dont c'est l'heure
 * (« Maintenant »), et ce qu'une carte ou une ligne dit d'un office
 * d'aujourd'hui (« jusqu'à 11:46 », « à partir de 19:52 »), aux horaires du
 * lieu choisi. Le paquet de l'accueil et Ma journée le disent pareil.
 */
export function useOfficeTimes() {
  const { t, locale } = useI18n();
  const now = useNow();
  const { place } = useZmanimLocation();

  const office = computed(() => currentTefilaWindow(place.value, now.value));
  const windows = computed(() => tefilaWindowsOfDay(place.value, now.value));

  /** Une heure, comme les horaires l'écrivent. */
  const time = (date: Date): string => formatZmanTime(date, place.value.tzid, locale.value);

  /** L'office dont c'est l'heure. */
  const isNow = (step: TefilaStep | undefined): boolean =>
    step !== undefined && step === office.value?.tefila;

  /**
   * Un office d'aujourd'hui dont l'heure n'est pas encore venue (Min'ha au
   * matin) : la pile de l'accueil le garde en retrait.
   */
  function isAhead(step: TefilaStep | undefined): boolean {
    if (step === undefined || isNow(step)) return false;
    const window = windows.value.find((w) => w.tefila === step);
    return window !== undefined && now.value < window.start;
  }

  /** Jusqu'à quand, ou à partir de quand, un office d'aujourd'hui ; null sans horaires. */
  function officeMeta(step: TefilaStep): string | null {
    const current = office.value;
    if (current && isNow(step)) return t("parcours.hub.until", { time: time(current.end) });
    const window = windows.value.find((w) => w.tefila === step);
    if (!window) return null;
    return now.value < window.start
      ? t("parcours.hub.from", { time: time(window.start) })
      : t("parcours.hub.until", { time: time(window.end) });
  }

  return { now, office, isNow, isAhead, officeMeta, time };
}
