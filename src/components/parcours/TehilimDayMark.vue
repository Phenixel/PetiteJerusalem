<script setup lang="ts">
/**
 * At the bottom of the library's Tehilim of the day page, for someone who
 * follows the Tehilim of the day in Mon parcours: « Marquer comme lu ». The
 * page can be reached from the study page or the home banner as well as
 * from the daily book, and the day's psalms read there must be markable
 * where the reading ends.
 *
 * It marks every psalm of the page in the daily book (useDailyBook), so a
 * psalm also taken as a daily text is marked too. It marks only when the
 * page gives the same psalms as Mon parcours: after sunset the library
 * already reads the next Hebrew day, while the day of Mon parcours turns at
 * dawn, and marking would then mark psalms that were not read. Then it says
 * so, with the psalms of the day of Mon parcours, and leads to the daily
 * book where they are marked: the page never ends without a way to mark.
 *
 * Loaded on demand (see TehilimDayPage): who never opens Mon parcours loads
 * nothing more.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useDailyBook } from "../../composables/useDailyBook";
import { useParcours } from "../../composables/useParcours";
import { DAILY_PAGE } from "../../composables/useParcoursViews";
import { psalmsLabel } from "../../composables/useTehilimDay";
import { tehilimOfCycle } from "../../services/dailyCycles";
import { localDayFrom } from "../../services/dateService";
import { haptic } from "../../services/haptics";
import AppIcon from "../icons/AppIcon.vue";

/** The psalms the page shows, by catalog id. */
const props = defineProps<{ psalms: number[] }>();

const { t } = useI18n();
const store = useParcours();
const book = useDailyBook();

/** Today's task of the Tehilim of the day of the month, if Mon parcours has one. */
const task = computed(
  () =>
    book.tasks.value.find((one) => {
      const objective = store.data.value.objectives[one.objectiveId];
      return objective?.kind === "cycle" && objective.cycle === "tehilim-month";
    }) ?? null,
);

/** Its psalms of the day in the daily book. */
const readings = computed(() => {
  const current = task.value;
  return current
    ? book.readings.value.filter((reading) =>
        reading.cycleTasks.some((one) => one.id === current.id),
      )
    : [];
});

/** The page and Mon parcours read the same psalms. */
const sameDay = computed(() => {
  const ids = readings.value.map((reading) => Number(reading.entry.id)).sort((a, b) => a - b);
  const shown = [...props.psalms].sort((a, b) => a - b);
  return ids.length > 0 && ids.length === shown.length && ids.every((id, i) => id === shown[i]);
});

/** The psalms of the day of Mon parcours, said when the page shows others. */
const dayRange = computed(() => {
  const date = localDayFrom(store.today.value) ?? new Date();
  date.setHours(12);
  return psalmsLabel(tehilimOfCycle("tehilim-month", date).psalms, t);
});

const done = computed(() => readings.value.length > 0 && readings.value.every((r) => r.done));

function toggle(): void {
  const read = !done.value;
  for (const reading of readings.value) book.setRead(reading, read, "tehilim_day_page");
  if (read) haptic("done");
}
</script>

<template>
  <div v-if="task && !sameDay" class="text-center">
    <p class="mx-auto max-w-sm text-[14px] leading-relaxed text-text-secondary">
      {{ t("tehilimDay.otherDay", { range: dayRange }) }}
    </p>
    <RouterLink :to="DAILY_PAGE" class="mark-btn mt-3">
      {{ t("tehilimDay.markInBook") }}
      <AppIcon name="chevron-right" :size="15" class="rtl:rotate-180" />
    </RouterLink>
  </div>
  <div v-else-if="task" class="text-center">
    <button
      type="button"
      class="mark-btn"
      :class="{ 'is-done': done }"
      :aria-pressed="done"
      @click="toggle"
    >
      <AppIcon v-if="done" name="circle-check" :size="17" />
      <span v-else class="mark-ring" />
      {{ done ? t("parcours.daily.readToday") : t("parcours.daily.markRead") }}
    </button>
  </div>
</template>

<style scoped>
/* The same mark as on the daily book, a little larger: the end of the page. */
.mark-btn {
  display: inline-flex;
  min-height: 48px;
  align-items: center;
  gap: 10px;
  padding: 0 22px;
  border-radius: var(--radius-pill);
  box-shadow: inset 0 0 0 1.5px var(--color-line-strong);
  color: var(--color-text-primary);
  font-size: 15px;
  font-weight: 700;
}
.mark-btn:hover {
  color: var(--color-primary);
}
.mark-btn.is-done {
  box-shadow: none;
  color: var(--color-primary);
}
.mark-ring {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-radius: var(--radius-pill);
}
</style>
