import { computed } from "vue";
import type { LampLevel } from "../components/parcours/ParcoursLamp.vue";
import { inDailyBook } from "../services/parcours/dailyBook";
import { lightOf, nextLight } from "../services/parcours/lights";
import { taskProgress } from "../services/parcours/schedule";
import { useParcours } from "./useParcours";

/**
 * La lampe de Mon parcours : la série en cours, sa lumière (la vieille lampe,
 * puis la bougie, la lanterne... voir services/parcours/lights.ts), et la
 * hauteur de sa flamme. Haute quand tout ce qu'aujourd'hui demandait est
 * fait ; basse quand la série est retombée à zéro ; entre les deux, sinon.
 * Et la journée, ce qui en est fait (« 2 sur 3 »).
 */
export function useParcoursLamp() {
  const store = useParcours();

  const days = computed(() => store.streak.value.current);

  /**
   * The day: what today asks, and what of it is done. Counted as the home
   * stack is: the daily book (the daily texts and the Tehilim of the day)
   * makes a single card there.
   */
  const today = computed(() => {
    const tasks = store.todayTasks.value;
    const day = store.today.value;
    const isDone = (task: (typeof tasks)[number]) =>
      taskProgress(store.data.value, task, day) === "done";
    const daily = (task: (typeof tasks)[number]) =>
      inDailyBook(store.data.value.objectives[task.objectiveId]);
    const texts = tasks.filter(daily);
    const grouped = texts.length > 0;
    const others = grouped ? tasks.filter((task) => !daily(task)) : tasks;
    const done = others.filter(isDone).length + (grouped && texts.every(isDone) ? 1 : 0);
    return { done, total: others.length + (grouped ? 1 : 0) };
  });

  const full = computed(() => today.value.total > 0 && today.value.done === today.value.total);

  const level = computed<LampLevel>(() =>
    full.value ? "high" : days.value > 0 ? "normal" : "low",
  );

  /** La lumière de la série en cours, et la suivante, encore dans l'ombre. */
  const light = computed(() => lightOf(days.value));
  const next = computed(() => nextLight(days.value));

  return { days, level, light, next, today };
}
