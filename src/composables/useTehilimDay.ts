import { computed, onMounted, onUnmounted, ref, type ComputedRef } from "vue";
import { HDate } from "@hebcal/core";
import { useNow } from "./useNow";
import { useZmanimLocation } from "./useZmanimLocation";
import { hebrewDateFor } from "../services/zmanimService";
import {
  getTehilimOfHebrewDay,
  getWeeklyParasha,
  type TehilimCycle,
  type WeeklyParasha,
} from "../services/dailyCycles";

/**
 * Le jour hébraïque courant, et ce qui en découle : les psaumes du cycle
 * mensuel, la paracha de la semaine.
 *
 * Deux choses manquaient aux pages qui les affichaient. Le jour d'abord : il
 * se lisait sur la date civile, alors que le jour hébraïque bascule à la
 * chkia ; le soir, après le coucher du soleil, ce sont déjà les psaumes du
 * lendemain qui se disent, et samedi soir la paracha suivante commence. Le
 * lieu des horaires (useZmanimLocation, Paris à défaut) donne l'heure de la
 * chkia. Le temps ensuite : une app laissée ouverte gardait les psaumes de la
 * veille. L'horloge partagée (useNow) et le retour à l'écran relisent le jour.
 *
 * Le calcul passe par une clé scalaire (le jour absolu) : l'horloge tique
 * toutes les trente secondes, mais rien en aval ne se recalcule tant que le
 * jour n'a pas changé.
 *
 * `live: false` fige le jour pendant que la page est à l'écran : il ne se
 * relit qu'au retour au premier plan. C'est le choix de la page des Tehilim du
 * jour, où les psaumes ne doivent pas changer sous les yeux de qui les lit.
 */
export interface DayClockOptions {
  live?: boolean;
}

function useHebrewDay(options: DayClockOptions = {}): ComputedRef<HDate> {
  const live = options.live ?? true;
  const now = useNow();
  const { place } = useZmanimLocation();
  // Le dernier retour à l'écran : l'horloge partagée peut avoir pris du retard
  // pendant que l'onglet dormait, et en mode figé c'est la seule source.
  const wokeAt = ref(new Date());

  function onVisibilityChange() {
    if (document.visibilityState === "visible") wokeAt.value = new Date();
  }
  onMounted(() => {
    wokeAt.value = new Date();
    document.addEventListener("visibilitychange", onVisibilityChange);
  });
  onUnmounted(() => document.removeEventListener("visibilitychange", onVisibilityChange));

  const instant = computed(() =>
    live && now.value.getTime() > wokeAt.value.getTime() ? now.value : wokeAt.value,
  );
  const dayAbs = computed(() => hebrewDateFor(place.value, instant.value, instant.value).abs());
  return computed(() => new HDate(dayAbs.value));
}

/** Les psaumes du jour, réactifs au temps et au lieu. */
export function useTehilimDay(options: DayClockOptions = {}): {
  hebrewDay: ComputedRef<HDate>;
  cycle: ComputedRef<TehilimCycle>;
} {
  const hebrewDay = useHebrewDay(options);
  const cycle = computed(() => getTehilimOfHebrewDay(hebrewDay.value));
  return { hebrewDay, cycle };
}

/**
 * La paracha de la semaine, réactive au temps : samedi soir, après la chkia,
 * c'est déjà celle de la semaine qui commence.
 */
export function useWeeklyParasha(options: DayClockOptions = {}): {
  hebrewDay: ComputedRef<HDate>;
  parasha: ComputedRef<WeeklyParasha | null>;
} {
  const hebrewDay = useHebrewDay(options);
  const parasha = computed(() => getWeeklyParasha(hebrewDay.value.greg()));
  return { hebrewDay, parasha };
}

/** La fonction de traduction, telle que vue-i18n la donne. */
type Translate = (key: string, named: Record<string, unknown>) => string;

/**
 * « Tehilim 83 à 87 », ou « Tehilim 119 » quand le jour n'en compte qu'un :
 * le libellé des psaumes du jour, le même sur l'encart, la page et la lecture
 * du jour.
 */
export function psalmsLabel(psalms: number[], t: Translate): string {
  if (psalms.length === 1) return t("dailyReading.options.psalmsOne", { n: psalms[0] });
  return t("dailyReading.options.psalmsRange", {
    from: psalms[0],
    to: psalms[psalms.length - 1],
  });
}
