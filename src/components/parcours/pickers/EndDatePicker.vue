<script setup lang="ts">
/**
 * Pour quand : les dates qu'on se donne d'habitude (la veille de Roch
 * Hachana, de Pessa'h), six mois, un an, ou une date à soi.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { milestoneEve } from "../../../services/parcours/calendar";
import { addDays } from "../../../services/parcours/days";
import type { DayKey } from "../../../services/parcours/model";
import AppDateField from "../../AppDateField.vue";
import ChoicePill from "./ChoicePill.vue";

const props = defineProps<{ today: DayKey }>();
const model = defineModel<DayKey>({ required: true });
const { t } = useI18n();

const presets = computed(() => [
  { key: "roshHashana", day: milestoneEve("roshHashana", props.today) },
  { key: "pessah", day: milestoneEve("pessah", props.today) },
  { key: "sixMonths", day: addDays(props.today, 182) },
  { key: "oneYear", day: addDays(props.today, 364) },
]);
</script>

<template>
  <div>
    <div class="flex flex-wrap gap-2" role="group" :aria-label="t('parcours.form.end')">
      <ChoicePill
        v-for="preset in presets"
        :key="preset.key"
        :on="model === preset.day"
        @click="model = preset.day"
      >
        {{ t(`parcours.ends.${preset.key}`) }}
      </ChoicePill>
    </div>
    <AppDateField
      v-model="model"
      class="mt-3"
      :min="addDays(today, 7)"
      :label="t('parcours.form.endDate')"
    />
  </div>
</template>
