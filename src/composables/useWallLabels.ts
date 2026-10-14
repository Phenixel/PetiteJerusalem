import { useI18n } from "vue-i18n";
import { getParashaForShabbat } from "../services/dailyCycles";
import { latinTexteName, hebrewName } from "../services/chiourTexte";
import { localDayFrom } from "../services/dateService";
import { dateTimeFormat } from "../services/intlCache";
import type { DayKey } from "../services/parcours/model";
import { isIsraelPlace } from "../services/zmanimService";
import { useZmanimLocation } from "./useZmanimLocation";

/**
 * Le nom d'une semaine du mur : sa paracha, comme on compte les semaines à la
 * synagogue (« Noa'h », « Lekh Lekha »). Une semaine de fête sans paracha se
 * nomme par la date de son Chabbat.
 */
export function useWallLabels() {
  const { t, locale } = useI18n();
  const { place } = useZmanimLocation();

  function weekLabel(saturday: DayKey): string {
    const date = localDayFrom(saturday) ?? new Date();
    const parasha = getParashaForShabbat(date, isIsraelPlace(place.value));
    const entry = parasha?.entries[0];
    if (entry) return locale.value === "he" ? hebrewName(entry) : latinTexteName(entry);
    return dateTimeFormat(locale.value, { day: "numeric", month: "short" }).format(date);
  }

  /**
   * Les initiales des jours, du dimanche au Chabbat : « D L M M J V C » en
   * français, le C de Chabbat plutôt que le S de samedi.
   */
  function weekdayInitials(): string[] {
    return t("parcours.weekdayInitials").split(",");
  }

  return { weekLabel, weekdayInitials };
}
