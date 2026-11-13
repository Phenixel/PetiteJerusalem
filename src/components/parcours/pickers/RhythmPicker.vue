<script setup lang="ts">
/**
 * Le rythme d'un programme : chaque jour, chaque jour sauf Chabbat et les
 * fêtes, ou à la semaine. Chaque option dit ce qu'elle demande. Pas de
 * rythme au mois (docs/design.md, « Un programme se lit au jour ou à la
 * semaine »).
 */
import { useI18n } from "vue-i18n";
import { RHYTHMS, type Rhythm } from "../../../services/parcours/model";

defineProps<{ paces: Record<Rhythm, string> }>();
const model = defineModel<Rhythm>({ required: true });
const { t } = useI18n();
</script>

<template>
  <div
    class="card divide-y divide-line overflow-hidden"
    role="radiogroup"
    :aria-label="t('parcours.form.rhythm')"
  >
    <button
      v-for="rhythm in RHYTHMS"
      :key="rhythm"
      type="button"
      role="radio"
      class="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-surface-soft"
      :aria-checked="model === rhythm"
      @click="model = rhythm"
    >
      <span
        class="grid size-5 flex-none place-items-center rounded-pill border-2"
        :class="model === rhythm ? 'border-brand' : 'border-text-primary/25'"
        aria-hidden="true"
      >
        <span v-if="model === rhythm" class="size-2.5 rounded-pill bg-brand" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-[15px] font-bold">{{ t(`parcours.rhythms.${rhythm}`) }}</span>
        <span class="block text-[13px] text-text-secondary">{{ paces[rhythm] }}</span>
      </span>
    </button>
  </div>
</template>
