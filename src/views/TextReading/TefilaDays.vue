<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { rubricText } from "../../services/textService";
import type { Rubric, TextDay } from "../../services/textService";

/**
 * Les jours d'un texte qui change avec le jour (les Hochanot, une suite par
 * jour de Souccot) : une rangée de pastilles, celle du jour lu pleine. Le
 * texte s'ouvre sur le jour du calendrier, marqué d'un point ; les autres se
 * lisent d'un appui, pour préparer le lendemain ou suivre hors de la fête.
 */
defineProps<{
  days: TextDay[];
  /** Le jour lu (sa clé `when`). */
  shown: string;
  /** Le jour du calendrier, quand c'en est un du texte. */
  today: string | null;
}>();

const emit = defineEmits<{ pick: [when: string] }>();

const { t, locale } = useI18n();

const say = (label: Rubric): string => rubricText(label, locale.value);
</script>

<template>
  <div class="mb-6" role="group" :aria-label="t('textReading.days.label')">
    <p class="mb-2 text-sm font-medium text-text-secondary">{{ t("textReading.days.label") }}</p>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="day in days"
        :key="day.when"
        type="button"
        :aria-pressed="day.when === shown"
        :title="day.when === today ? t('textReading.days.today') : undefined"
        :class="[
          'flex items-center gap-1.5 rounded-pill px-3 py-1 text-sm font-medium transition-colors',
          day.when === shown
            ? 'bg-primary text-white'
            : 'bg-black/5 text-text-secondary hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15',
        ]"
        @click="emit('pick', day.when)"
      >
        {{ say(day.label) }}
        <!-- Le jour du calendrier : un point, pour qu'on le retrouve après
             avoir lu un autre jour. -->
        <span
          v-if="day.when === today"
          class="h-1.5 w-1.5 rounded-pill"
          :class="day.when === shown ? 'bg-white' : 'bg-primary'"
          aria-hidden="true"
        />
        <span v-if="day.when === today" class="sr-only">{{ t("textReading.days.today") }}</span>
      </button>
    </div>
  </div>
</template>
