import { computed, ref } from "vue";
import { createAccountPreference } from "./createAccountPreference";
import { HOLIDAY_THEMES, holidayThemeOn, type HolidayTheme } from "../services/holidayThemes";

/**
 * Le thème de la fête en cours, et le réglage qui l'autorise.
 *
 * Deux choses décident : le calendrier (voir services/holidayThemes) et
 * l'interrupteur « Thèmes des fêtes » des réglages d'apparence, allumé
 * d'office. Le réglage voyage comme le thème choisi : sur l'appareil sans
 * compte, chez Firestore avec un compte (createAccountPreference).
 *
 * Ce que le thème de fête change se lit ailleurs : les couleurs dans
 * useTheme (qui le fait passer devant le thème choisi), le bouton rond des
 * horaires dans BottomTabBar, les ornements de l'accueil dans HolidayGreeting.
 */

const enabled = createAccountPreference<boolean>({
  field: "holidayThemes",
  defaultValue: true,
  isValid: (value): value is boolean => typeof value === "boolean",
  eventName: "holiday_themes_changed",
  eventProps: (value, _previous, scope) => ({ enabled: value, scope }),
  failedEventName: "holiday_themes_change_failed",
  failedEventProps: (value) => ({ enabled: value, scope: "account" }),
});

/**
 * Le jour qu'il est, pour le calendrier. Une app laissée ouverte sur le
 * téléphone doit changer de thème dans la nuit sans être relancée : la date
 * se relit à intervalle régulier et à chaque retour au premier plan.
 */
const today = ref(new Date());
const REFRESH_MS = 15 * 60_000;

export function refreshHolidayDay(now: Date = new Date()): void {
  today.value = now;
}

if (typeof window !== "undefined") {
  setInterval(() => refreshHolidayDay(), REFRESH_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshHolidayDay();
  });
}

/** Le thème que la date appelle, que le réglage soit allumé ou non. */
const holidayThemeOfDay = computed<HolidayTheme | null>(() => holidayThemeOn(today.value));

/** Le thème de fête à l'écran : celui du jour, si le réglage l'autorise. */
export const activeHolidayTheme = computed<HolidayTheme | null>(() =>
  enabled.current.value ? holidayThemeOfDay.value : null,
);

export function useHolidayTheme() {
  return {
    holidayThemesEnabled: enabled.current,
    activeHolidayTheme,
    holidayThemeOfDay,
    holidayThemes: HOLIDAY_THEMES,
    setHolidayThemesEnabled: enabled.set,
    loadHolidayThemes: enabled.loadForUser,
    loadGuestHolidayThemes: enabled.loadForGuest,
    resetHolidayThemes: enabled.reset,
  };
}
