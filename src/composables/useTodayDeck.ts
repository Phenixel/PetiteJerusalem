import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { DayKey } from "../services/parcours/model";
import { dayOrder, deckOrder } from "../services/parcours/moments";
import { currentTefilaWindow } from "../services/sidourService";
import { formatZmanTime } from "../services/zmanimService";
import { useCurrentMoment } from "./useCurrentMoment";
import { useNow } from "./useNow";
import { useParcours } from "./useParcours";
import { useParcoursViews, type TaskView } from "./useParcoursViews";
import { useZmanimLocation } from "./useZmanimLocation";

/**
 * Le paquet de l'accueil : les tâches d'aujourd'hui, dans l'ordre où elles se
 * présentent (docs/design.md, « Le paquet de l'accueil »).
 *
 * En tête, l'office dont c'est l'heure, s'il est dans le parcours : la carte
 * dit « Maintenant » et jusqu'à quand, comme le raccourci du Sidour qu'elle
 * remplace. Puis le moment présent et ce qui se fait dans la journée, les
 * moments qui viennent, ceux déjà passés. Ce qu'on a remis « plus tard »
 * passe sous le paquet, le temps de la journée ; ce qui est fait, ou mis de
 * côté pour aujourd'hui, le quitte et se retrouve dans le portefeuille.
 */

/** Ce qu'on a remis à plus tard, le jour où on l'a fait : la journée suivante repart de zéro. */
const postponed = ref<{ day: DayKey; ids: string[] }>({ day: "", ids: [] });

export function useTodayDeck() {
  const { t, locale } = useI18n();
  const store = useParcours();
  const views = useParcoursViews();
  const moment = useCurrentMoment();
  const now = useNow();
  const { place } = useZmanimLocation();

  const today = store.today;
  const office = computed(() => currentTefilaWindow(place.value, now.value));
  const later = computed(() => (postponed.value.day === today.value ? postponed.value.ids : []));

  const all = computed<TaskView[]>(() =>
    store.todayTasks.value.map((task) => views.taskView(task, today.value)),
  );

  /** L'office de l'heure, quand le parcours le porte. */
  const isNow = (view: TaskView): boolean =>
    view.task.step !== undefined && view.task.step === office.value?.tefila;

  function rank(view: TaskView): number {
    const delayed = later.value.indexOf(view.task.id);
    if (delayed >= 0) return 100 + delayed;
    if (isNow(view)) return -1;
    return deckOrder(view.task.moment, moment.value);
  }

  /** Ce qui reste à faire, la carte du dessus en premier. */
  const pending = computed(() =>
    all.value
      .filter((view) => view.progress !== "done" && !view.skipped)
      .sort((a, b) => rank(a) - rank(b)),
  );

  /** La carte du dessus, telle qu'elle se montre : l'office de l'heure dit jusqu'à quand. */
  const top = computed<TaskView | null>(() => {
    const view = pending.value[0];
    if (!view) return null;
    const window = office.value;
    if (!window || !isNow(view)) return view;
    const time = formatZmanTime(window.end, place.value.tzid, locale.value);
    return { ...view, kicker: t("parcours.hub.now"), meta: t("parcours.hub.until", { time }) };
  });

  /** La journée entière, du matin au coucher : le portefeuille et la barre. */
  const day = computed(() =>
    [...all.value].sort((a, b) => dayOrder(a.task.moment) - dayOrder(b.task.moment)),
  );

  /** Le parcours porte les offices : le raccourci du Sidour de l'accueil se tait. */
  const coversOffices = computed(() => all.value.some((view) => view.task.step !== undefined));

  /** « Plus tard » : la carte passe sous le paquet. */
  function postpone(view: TaskView): void {
    const ids = later.value.filter((id) => id !== view.task.id);
    postponed.value = { day: today.value, ids: [...ids, view.task.id] };
  }

  return { all, day, pending, top, coversOffices, postpone };
}
