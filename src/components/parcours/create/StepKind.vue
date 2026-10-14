<script setup lang="ts">
/**
 * Nouvel objectif, 1 : qu'est-ce qu'on prend. Finir un texte (un volume à
 * choisir), suivre une lecture du calendrier, relire un texte chaque jour, ou
 * se donner une habitude.
 */
import { useI18n } from "vue-i18n";
import { bindingOf } from "../../../content/bindings";
import {
  HABIT_PRESETS,
  type CycleId,
  type HabitPreset,
  type ProgramCorpus,
} from "../../../services/parcours/model";
import ProgramVolume from "../ProgramVolume.vue";
import ChoicePill from "../pickers/ChoicePill.vue";

defineProps<{ takenCycles: CycleId[] }>();
const emit = defineEmits<{
  (e: "program", corpus: ProgramCorpus): void;
  (e: "cycle", cycle: CycleId): void;
  (e: "text"): void;
  (e: "habit", preset: HabitPreset): void;
}>();

const { t } = useI18n();

const CORPORA: ProgramCorpus[] = ["michna", "talmud", "tanakh", "tehilim"];
const CYCLES: CycleId[] = ["tehilim-month", "parasha"];
</script>

<template>
  <div class="space-y-10">
    <section>
      <h2 class="text-lg font-bold">{{ t("parcours.create.finish") }}</h2>
      <p class="text-sm text-text-secondary">{{ t("parcours.create.finishHint") }}</p>
      <div class="mt-4 grid grid-cols-4 gap-3">
        <button
          v-for="corpus in CORPORA"
          :key="corpus"
          type="button"
          class="press-feedback flex flex-col items-center gap-1.5"
          @click="emit('program', corpus)"
        >
          <ProgramVolume
            :color="bindingOf(corpus)"
            :lines="[t(`parcours.corpus.${corpus}`)]"
            :progress="0"
            class="max-w-full"
          />
        </button>
      </div>
    </section>

    <section>
      <h2 class="text-lg font-bold">{{ t("parcours.create.calendar") }}</h2>
      <div class="card mt-3 divide-y divide-line overflow-hidden">
        <button
          v-for="cycle in CYCLES"
          :key="cycle"
          type="button"
          class="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-surface-soft disabled:opacity-60"
          :disabled="takenCycles.includes(cycle)"
          @click="emit('cycle', cycle)"
        >
          <span class="min-w-0 flex-1">
            <span class="block text-[15px] font-bold">{{
              t(`parcours.cycles.${cycle}.title`)
            }}</span>
            <span class="block text-[13px] text-text-secondary">
              {{
                takenCycles.includes(cycle)
                  ? t("parcours.create.taken")
                  : t(`parcours.cycles.${cycle}.hint`)
              }}
            </span>
          </span>
        </button>
        <button
          type="button"
          class="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-surface-soft"
          @click="emit('text')"
        >
          <span class="min-w-0 flex-1">
            <span class="block text-[15px] font-bold">{{ t("parcours.create.dailyText") }}</span>
            <span class="block text-[13px] text-text-secondary">{{
              t("parcours.create.dailyTextHint")
            }}</span>
          </span>
        </button>
      </div>
    </section>

    <section>
      <h2 class="text-lg font-bold">{{ t("parcours.create.habit") }}</h2>
      <div class="mt-3 flex flex-wrap gap-2">
        <ChoicePill v-for="preset in HABIT_PRESETS" :key="preset" @click="emit('habit', preset)">
          {{ t(`parcours.habits.${preset}`) }}
        </ChoicePill>
      </div>
    </section>
  </div>
</template>
