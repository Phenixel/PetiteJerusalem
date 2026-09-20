<script setup lang="ts">
// Les sept derniers jours, en pastilles, la lettre du jour dessous : réussie,
// entamée, manquée, en pause. Voir ses trous motive plus qu'un
// chiffre. Posée sur la carte de progression de la lecture du jour et sur la
// carte du tableau de bord.
import { useI18n } from "vue-i18n";
import type { DayCell } from "../services/dailyHistory";
import AppIcon from "./icons/AppIcon.vue";

// `editable` : un jour passé se touche pour être corrigé (voir DailyDayEditor) ;
// le parent décide lesquels, le composant ne fait que le proposer.
defineProps<{ days: DayCell[]; compact?: boolean; editable?: boolean }>();
const emit = defineEmits<{ (e: "select", cell: DayCell): void }>();

const { t } = useI18n();

const STATE_CLASS: Record<DayCell["state"], string> = {
  done: "bg-primary text-white",
  partial: "bg-primary/25 text-primary",
  missed: "bg-black/5 text-text-secondary/60 dark:bg-white/10",
  pause: "bg-transparent text-text-secondary/50 border border-dashed border-line",
  future: "bg-transparent text-text-secondary/40 border border-line",
  empty: "bg-black/5 text-text-secondary/60 dark:bg-white/10",
};
</script>

<template>
  <ol class="flex items-center justify-between gap-1" :aria-label="t('dailyReading.week.title')">
    <li
      v-for="cell in days"
      :key="cell.key"
      class="flex flex-col items-center gap-1"
      :title="t(`dailyReading.week.states.${cell.state}`)"
    >
      <component
        :is="editable && cell.state !== 'future' && !cell.today ? 'button' : 'span'"
        :type="editable ? 'button' : undefined"
        class="flex items-center justify-center rounded-full font-semibold tabular-nums"
        :class="[
          STATE_CLASS[cell.state],
          compact ? 'w-6 h-6 text-[11px]' : 'w-8 h-8 text-xs',
          cell.today ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : '',
          editable && cell.state !== 'future' && !cell.today
            ? 'transition-transform hover:scale-110'
            : '',
        ]"
        :aria-label="editable ? t('dailyReading.editor.open', { day: cell.day }) : undefined"
        @click="editable && emit('select', cell)"
      >
        <AppIcon v-if="cell.state === 'done'" name="check" :size="compact ? 11 : 14" />
        <template v-else>{{ cell.day }}</template>
      </component>
      <span v-if="!compact" class="text-[10px] text-text-secondary/70">
        {{ t(`dailyReading.week.days.${cell.weekday}`) }}
      </span>
    </li>
  </ol>
</template>
