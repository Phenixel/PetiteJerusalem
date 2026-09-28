<script setup lang="ts">
// Le mois en grille : chaque journée réussie s'allume, les entamées à
// moitié, les pauses (Chabbat, Yom Tov) en pointillé, les manquées vides.
// On feuillette les mois d'avant sur la profondeur de l'historique.
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { monthGrid, type DailyHistory } from "../services/dailyHistory";
import { localDayFrom } from "../services/dateService";
import AppIcon from "./icons/AppIcon.vue";

const props = defineProps<{
  history: DailyHistory;
  today: string;
  isPause: (key: string) => boolean;
}>();

const { t, locale } = useI18n();

const todayDate = computed(() => localDayFrom(props.today) ?? new Date());
// Le mois affiché, en décalage par rapport au mois courant (0, -1, -2…).
const offset = ref(0);
const shown = computed(() => {
  const d = new Date(todayDate.value.getFullYear(), todayDate.value.getMonth() + offset.value, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
});
const title = computed(() =>
  new Intl.DateTimeFormat(locale.value, { month: "long", year: "numeric" }).format(
    new Date(shown.value.year, shown.value.month, 1),
  ),
);
const cells = computed(() =>
  monthGrid(shown.value.year, shown.value.month, props.history, props.today, props.isPause),
);
// Pas plus loin en arrière que l'historique ne remonte (quatre mois).
const canGoBack = computed(() => offset.value > -4);

const STATE_CLASS: Record<string, string> = {
  done: "bg-primary text-white",
  partial: "bg-primary/25 text-primary",
  missed: "bg-black/5 text-text-secondary/60 dark:bg-white/10",
  pause: "border border-dashed border-line text-text-secondary/50",
  future: "text-text-secondary/40",
  empty: "text-text-secondary/60",
};
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-3">
      <button
        class="btn btn-soft btn-sm"
        :disabled="!canGoBack"
        :aria-label="t('dailyReading.calendar.previous')"
        @click="offset -= 1"
      >
        <AppIcon name="chevron-left" :size="14" class="rtl:rotate-180" />
      </button>
      <p class="font-semibold text-text-primary capitalize">{{ title }}</p>
      <button
        class="btn btn-soft btn-sm"
        :disabled="offset >= 0"
        :aria-label="t('dailyReading.calendar.next')"
        @click="offset += 1"
      >
        <AppIcon name="chevron-right" :size="14" class="rtl:rotate-180" />
      </button>
    </div>
    <div class="grid grid-cols-7 gap-1 text-center">
      <span
        v-for="i in 7"
        :key="`h${i}`"
        class="text-[10px] font-semibold text-text-secondary/70 pb-1"
      >
        {{ t(`dailyReading.week.days.${i - 1}`) }}
      </span>
      <template v-for="(cell, index) in cells" :key="cell?.key ?? `empty-${index}`">
        <span v-if="!cell"></span>
        <span
          v-else
          class="mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium tabular-nums"
          :class="[
            STATE_CLASS[cell.state],
            cell.today ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : '',
          ]"
          :title="t(`dailyReading.week.states.${cell.state}`)"
        >
          <AppIcon v-if="cell.state === 'done'" name="check" :size="14" />
          <template v-else>{{ cell.day }}</template>
        </span>
      </template>
    </div>
    <p class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-secondary/80">
      <span class="inline-flex items-center gap-1.5">
        <span class="inline-block h-2.5 w-2.5 rounded-full bg-primary"></span>
        {{ t("dailyReading.week.states.done") }}
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="inline-block h-2.5 w-2.5 rounded-full bg-primary/25"></span>
        {{ t("dailyReading.week.states.partial") }}
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-line"></span>
        {{ t("dailyReading.week.states.pause") }}
      </span>
    </p>
  </div>
</template>
