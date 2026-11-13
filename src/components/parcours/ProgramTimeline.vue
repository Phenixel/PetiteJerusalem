<script setup lang="ts">
/**
 * Où en est un programme sur son année : une piste de son départ à sa fin,
 * remplie de ce qui est lu, avec un trait là où l'on en serait au rythme
 * prévu, et le nom des mois hébraïques dessous. À plat.
 */
import { HDate } from "@hebcal/core";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { localDayFrom } from "../../services/dateService";
import { daysBetween } from "../../services/parcours/days";
import type { DayKey } from "../../services/parcours/model";
import { hebrewMonthName } from "../../services/zmanimService";

const props = defineProps<{
  start: DayKey;
  end: DayKey;
  today: DayKey;
  /** Ce qui est lu, de 0 à 1. */
  done: number;
}>();

const { t, locale } = useI18n();

const span = computed(() => Math.max(1, daysBetween(props.start, props.end)));
const todayShare = computed(() =>
  Math.min(1, Math.max(0, daysBetween(props.start, props.today) / span.value)),
);

/** Quatre mois repères : le départ, deux entre deux, la fin. */
const months = computed(() =>
  [0, 1 / 3, 2 / 3, 1].map((share) => {
    const date = localDayFrom(props.start) ?? new Date();
    date.setDate(date.getDate() + Math.round(share * span.value));
    date.setHours(12);
    const hd = new HDate(date);
    return hebrewMonthName(hd.getMonth(), hd.getFullYear(), locale.value);
  }),
);
</script>

<template>
  <div role="img" :aria-label="t('parcours.program.timeline', { percent: Math.floor(done * 100) })">
    <div class="relative h-2.5 rounded-pill bg-text-primary/8">
      <span
        class="absolute inset-y-0 start-0 rounded-pill bg-primary"
        :style="{ width: `${Math.max(done * 100, done > 0 ? 3 : 0)}%` }"
      />
      <span
        class="absolute -top-1.5 h-5.5 w-0.5 rounded-pill bg-text-primary"
        :style="{ insetInlineStart: `${todayShare * 100}%` }"
      />
    </div>
    <div class="mt-2 flex justify-between text-sm text-text-secondary">
      <span v-for="(month, i) in months" :key="i">{{ month }}</span>
    </div>
  </div>
</template>
