import { computed } from "vue";
import type { LampLevel } from "../components/parcours/ParcoursLamp.vue";
import { taskProgress } from "../services/parcours/schedule";
import { useParcours } from "./useParcours";

/**
 * La lampe de Mon parcours : la série en cours, et la hauteur de sa flamme.
 * Haute quand tout ce qu'aujourd'hui demandait est fait ; basse quand la
 * série est retombée à zéro ; entre les deux, sinon.
 */
export function useParcoursLamp() {
  const store = useParcours();

  const days = computed(() => store.streak.value.current);

  const full = computed(() => {
    const tasks = store.todayTasks.value;
    const day = store.today.value;
    return (
      tasks.length > 0 &&
      tasks.every((task) => taskProgress(store.data.value, task, day) === "done")
    );
  });

  const level = computed<LampLevel>(() =>
    full.value ? "high" : days.value > 0 ? "normal" : "low",
  );

  return { days, level };
}
