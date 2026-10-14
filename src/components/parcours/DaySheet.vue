<script setup lang="ts">
/**
 * Un jour du mur, ouvert : ce qu'il y avait à faire, à cocher après coup.
 * Tout se déclare, des mois après s'il le faut ; rien ne se compte contre soi.
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
import AppModal from "../AppModal.vue";
import TaskRow from "./TaskRow.vue";

const props = defineProps<{ day: DayKey | null; source: string }>();
const emit = defineEmits<{ (e: "close"): void }>();

const { t, locale } = useI18n();
const store = useParcours();
const views = useParcoursViews();

const title = computed(() => {
  if (!props.day) return "";
  const date = localDayFrom(props.day) ?? new Date();
  return dateTimeFormat(locale.value, { weekday: "long", day: "numeric", month: "long" }).format(
    date,
  );
});

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

function toggle(index: number, done: boolean): void {
  const view = rows.value[index];
  if (!view || !props.day) return;
  store.setDone(view.task, props.day, done, props.source);
}
</script>

<template>
  <AppModal :open="day !== null" :label="title" @close="emit('close')">
    <h2 class="text-center font-display text-2xl font-bold first-letter:uppercase">{{ title }}</h2>
    <p class="mt-1 text-center text-sm text-text-secondary">{{ t("parcours.daySheet.hint") }}</p>
    <div v-if="rows.length" class="card mt-5 divide-y divide-line overflow-hidden">
      <TaskRow
        v-for="(view, index) in rows"
        :key="view.key"
        :view="view"
        @toggle="(done) => toggle(index, done)"
      />
    </div>
    <p v-else class="mt-5 text-center text-text-secondary">{{ t("parcours.daySheet.empty") }}</p>
    <button type="button" class="btn btn-soft mt-5 w-full" @click="emit('close')">
      {{ t("common.close") }}
    </button>
  </AppModal>
</template>
