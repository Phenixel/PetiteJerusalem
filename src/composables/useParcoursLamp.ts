import { computed } from "vue";
import type { LampLevel } from "../components/parcours/ParcoursLamp.vue";
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
   * La journée : ce qu'aujourd'hui demande, et ce qui en est fait. Comptée
   * comme la pile de l'accueil : deux textes du jour ou plus n'y font qu'une
   * carte, « Lecture du jour ».
   */
  const today = computed(() => {
    const tasks = store.todayTasks.value;
    const day = store.today.value;
    const isDone = (task: (typeof tasks)[number]) =>
      taskProgress(store.data.value, task, day) === "done";
    const texts = tasks.filter((task) => task.kind === "text");
    const grouped = texts.length >= 2;
    const others = grouped ? tasks.filter((task) => task.kind !== "text") : tasks;
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
