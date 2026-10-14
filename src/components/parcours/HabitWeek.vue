<script setup lang="ts">
/**
 * La semaine d'une habitude, en petites cases plates, du dimanche au Chabbat.
 * Dans une liste, on ne bâtit pas de mur : la pierre est pour l'historique
 * (docs/design.md, « Le mur se bâtit en pierres, et seulement lui »).
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import { addDays, dayRange, weekStart } from "../../services/parcours/days";
import type { Objective } from "../../services/parcours/model";
import { isSkipped, taskProgress } from "../../services/parcours/schedule";

const props = defineProps<{ objective: Objective }>();

const { t } = useI18n();
const store = useParcours();

type Cell = "done" | "partial" | "none" | "today" | "future" | "off";

const cells = computed<Cell[]>(() => {
  const today = store.today.value;
  const data = store.data.value;
  const start = weekStart(today);
  return dayRange(start, addDays(start, 6)).map((day) => {
    const tasks = store.tasksOn(day).filter((task) => task.objectiveId === props.objective.id);
    if (tasks.length === 0) return "off";
    if (day > today) return "future";
    const live = tasks.filter((task) => !isSkipped(data.days[day], task.id));
    if (live.length === 0) return "off";
    const progress = live.map((task) => taskProgress(data, task, day));
    if (progress.every((p) => p === "done")) return "done";
    if (progress.some((p) => p !== "none")) return "partial";
    return day === today ? "today" : "none";
  });
});

const held = computed(() => cells.value.filter((cell) => cell === "done").length);
</script>

<template>
  <span class="habit-week" :aria-label="t('parcours.habitWeek', { n: held }, held)">
    <i v-for="(cell, i) in cells" :key="i" :class="`cell-${cell}`" />
  </span>
</template>

<style scoped>
.habit-week {
  display: flex;
  gap: 2px;
}
.habit-week i {
  display: block;
  width: 13px;
  height: 13px;
  border-radius: 2px;
}
/* Les teintes de la pierre, à plat : la même famille que le mur, sans le relief. */
.cell-done {
  background: #e6cd9c;
  box-shadow: inset 0 0 0 2px #cfb07a;
}
.cell-partial {
  background: #efe6d6;
  box-shadow: inset 6px 0 0 #e6cd9c;
}
.cell-none {
  background: color-mix(in srgb, var(--color-text-primary) 8%, transparent);
}
.cell-today {
  box-shadow: inset 0 0 0 2px var(--color-primary);
}
.cell-future {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-text-primary) 20%, transparent);
}
.cell-off {
  background: color-mix(in srgb, var(--color-text-primary) 3%, transparent);
}
</style>
