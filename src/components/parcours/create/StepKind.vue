<script setup lang="ts">
/**
 * Nouvel objectif, 1 (P2-Creer1) : que voulez-vous accomplir ? Finir un
 * texte (un volume à prendre sur la planche), suivre un cycle (les Tehilim
 * de la semaine ou du mois, la paracha ; un texte relu chaque jour), ou
 * prendre une habitude, d'un modèle ou avec ses mots.
 */
import { useI18n } from "vue-i18n";
import { bindingOf } from "../../../content/bindings";
import type { CycleId, HabitPreset, ProgramCorpus } from "../../../services/parcours/model";
import ProgramVolume from "../ProgramVolume.vue";

defineProps<{ takenCycles: CycleId[] }>();
const emit = defineEmits<{
  (e: "program", corpus: ProgramCorpus): void;
  (e: "cycle", cycle: CycleId): void;
  (e: "text"): void;
  (e: "habit", preset: HabitPreset): void;
}>();

const { t } = useI18n();

const CORPORA: ProgramCorpus[] = ["michna", "talmud", "tanakh", "tehilim"];
const CYCLES: CycleId[] = ["tehilim-week", "tehilim-month", "parasha"];
/** Les modèles d'habitude ; « Avec mes mots » ferme la liste. */
const HABITS: HabitPreset[] = [
  "tefilot",
  "tefilin",
  "chema-al-hamita",
  "birkat-hamazon",
  "tsedaka",
];
</script>

<template>
  <div>
    <p class="create-lab">{{ t("parcours.create.finish") }}</p>
    <div class="books">
      <button
        v-for="corpus in CORPORA"
        :key="corpus"
        type="button"
        class="press-feedback book"
        :aria-label="t(`parcours.corpus.${corpus}`)"
        @click="emit('program', corpus)"
      >
        <ProgramVolume
          :color="bindingOf(corpus)"
          :lines="[t(`parcours.corpus.${corpus}`)]"
          :progress="0"
          :scale="0.69"
        />
      </button>
    </div>
    <div class="plank" aria-hidden="true" />
    <p class="mt-2.5 text-[13px] text-text-secondary">{{ t("parcours.create.finishHint") }}</p>

    <p class="create-lab">{{ t("parcours.create.calendar") }}</p>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="cycle in CYCLES"
        :key="cycle"
        type="button"
        class="pick-pill"
        :disabled="takenCycles.includes(cycle)"
        :title="takenCycles.includes(cycle) ? t('parcours.create.taken') : undefined"
        @click="emit('cycle', cycle)"
      >
        {{ t(`parcours.cycles.${cycle}.pick`) }}
      </button>
      <button type="button" class="pick-pill" @click="emit('text')">
        {{ t("parcours.create.dailyText") }}
      </button>
    </div>

    <p class="create-lab">{{ t("parcours.create.habit") }}</p>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="preset in HABITS"
        :key="preset"
        type="button"
        class="pick-pill"
        @click="emit('habit', preset)"
      >
        {{ t(`parcours.habits.${preset}`) }}
      </button>
      <button type="button" class="pick-pill pick-mine" @click="emit('habit', 'custom')">
        {{ t("parcours.create.ownWords") }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.create-lab {
  margin: 30px 0 12px;
  font-size: 15px;
  font-weight: 700;
}
/* Les volumes debout sur leur planche. */
.books {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 6px;
  padding: 0 4px;
}
.book {
  display: block;
  flex: 1;
  max-width: 66px;
}
.book :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
  margin-bottom: -11px;
}
.plank {
  position: relative;
  height: 8px;
  margin-top: 2px;
  border-radius: 3px;
  background: #b59a70;
  box-shadow: 0 3px 6px rgb(58 46 30 / 0.18);
}
:root.dark .plank {
  background: #7c654a;
}
/* Un choix qui mène plus loin : une pastille posée sur la page. */
.pick-pill {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  padding: 0 15px;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.pick-pill:disabled {
  opacity: 0.5;
  cursor: default;
}
.pick-mine {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--color-line-strong);
  color: var(--color-primary);
}
</style>
