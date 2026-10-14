<script setup lang="ts">
/**
 * Un jour du mur, ouvert (P2-Parcours, P2-Annee) : une feuille qui monte du
 * bas, le jour en titre, et ce qu'il y avait à faire, un nœud par tâche à
 * cocher après coup. Tout se déclare, des mois après s'il le faut ; un jour
 * de repos le dit, et ce qu'on y coche compte quand même.
 */
import { computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import { useParcoursViews } from "../../composables/useParcoursViews";
import { analyticsService } from "../../services/analyticsService";
import { localDayFrom } from "../../services/dateService";
import { dateTimeFormat } from "../../services/intlCache";
import type { DayKey } from "../../services/parcours/model";
import { dayOrder } from "../../services/parcours/moments";
import BottomSheet from "./BottomSheet.vue";

const props = defineProps<{ day: DayKey | null; source: string }>();
const emit = defineEmits<{ (e: "close"): void }>();

const { t, locale } = useI18n();
const store = useParcours();
const views = useParcoursViews();

/** « Lundi 12 octobre 2026 ». */
const title = computed(() => {
  if (!props.day) return "";
  const date = localDayFrom(props.day) ?? new Date();
  date.setHours(12);
  return dateTimeFormat(locale.value, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
});

/** Chabbat, une fête : rien n'était attendu ce jour-là. */
const rest = computed(() => (props.day ? store.isRest.value(props.day) : false));

const rows = computed(() => {
  const day = props.day;
  if (!day) return [];
  return store
    .tasksOn(day)
    .slice()
    .sort((a, b) => dayOrder(a.moment) - dayOrder(b.moment))
    .map((task) => views.taskView(task, day));
});

watch(
  () => props.day,
  (day) => {
    if (day) analyticsService.capture("parcours_day_opened", { source: props.source });
  },
);

function toggle(index: number): void {
  const view = rows.value[index];
  if (!view || !props.day) return;
  store.setDone(view.task, props.day, view.progress !== "done", props.source);
}
</script>

<template>
  <BottomSheet :open="day !== null" :label="title" @close="emit('close')">
    <p class="text-xl font-extrabold first-letter:uppercase">{{ title }}</p>
    <p class="mt-0.5 text-sm text-text-secondary">
      {{ rest ? t("parcours.daySheet.rest") : t("parcours.daySheet.hint") }}
    </p>
    <div v-if="rows.length" class="mt-3">
      <div v-for="(view, index) in rows" :key="view.key" class="flex items-center gap-3 py-2">
        <button
          type="button"
          class="day-knot"
          :class="{ 'is-done': view.progress === 'done' }"
          :aria-pressed="view.progress === 'done'"
          :aria-label="
            view.progress === 'done'
              ? t('parcours.row.uncheck', { name: view.title })
              : t('parcours.row.check', { name: view.title })
          "
          @click="toggle(index)"
        />
        <span class="text-[15px] font-semibold">{{ view.title }}</span>
      </div>
    </div>
    <p v-else class="mt-3 text-text-secondary">{{ t("parcours.daySheet.empty") }}</p>
    <button type="button" class="btn btn-primary sheet-close" @click="emit('close')">
      {{ t("common.close") }}
    </button>
  </BottomSheet>
</template>

<style scoped>
.day-knot {
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  box-shadow: inset 0 0 0 2px var(--color-line-strong);
}
.day-knot.is-done {
  background: var(--color-brand);
  box-shadow: none;
}
.sheet-close {
  width: 100%;
  min-height: 44px;
  margin-top: 12px;
  font-size: 14px;
  font-weight: 700;
}
</style>
