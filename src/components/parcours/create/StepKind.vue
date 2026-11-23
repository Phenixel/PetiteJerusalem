<script setup lang="ts">
/**
 * New objective, 1 (P2-Creer1): what do you want to accomplish? Four
 * answers, each its own way of choosing a book:
 *
 *  - read every day: the daily book (the Tehilim of the day, a psalm, a page
 *    one loves), everything taken there lands in the same volume;
 *  - finish a text by a date: a volume to take off the plank;
 *  - follow a cycle of the calendar: the parasha, the Daf Yomi;
 *  - take a habit, from a model or in one's own words.
 *
 * The Tehilim of the day are offered only in the first: they are read every
 * day, among the other psalms, not finished by a date.
 *
 * A model already taken is no longer offered: one does not take the tefilot
 * twice. Removed from one's journey, it comes back in the list. Tapping it
 * adds nothing: it opens the model's sheet (PresetSheet), where one confirms.
 *
 * Everything happens on the same page: what is chosen stays marked here (the
 * volume taken off the plank, the pill in color), and the rest unfolds below.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { bindingOf } from "../../../config/bindings";
import {
  CYCLE_CHOICES,
  type CycleChoice,
  type HabitPreset,
  type ProgramCorpus,
} from "../../../services/parcours/model";
import AppIcon from "../../icons/AppIcon.vue";
import ProgramVolume from "../ProgramVolume.vue";

const props = defineProps<{
  /** What is chosen and set below: `program:michna`, `habit:custom`, `text`. */
  selected: string | null;
  /** The daily book already holds something: the row says one adds to it. */
  hasDailyBook: boolean;
  takenCycles: CycleChoice[];
  takenHabits: HabitPreset[];
  /** The Tehilim are finished whole: one program at a time. */
  takenTehilim: boolean;
}>();
const emit = defineEmits<{
  (e: "program", corpus: ProgramCorpus): void;
  (e: "cycle", cycle: CycleChoice): void;
  (e: "text"): void;
  (e: "habit", preset: HabitPreset): void;
}>();

const { t } = useI18n();

const CORPORA: ProgramCorpus[] = ["michna", "talmud", "tanakh", "tehilim"];
/**
 * The habit models: what is done every day, with no too precise time to
 * keep; « Avec mes mots » closes the list. The tefilin and Birkat Hamazon
 * are no longer there (the tefilot and the meal already carry them).
 */
const HABITS: HabitPreset[] = [
  "tefilot",
  "chema-al-hamita",
  "tsedaka",
  "chmirat-halachon",
  "limoud",
];

const corpora = computed(() =>
  CORPORA.filter((corpus) => corpus !== "tehilim" || !props.takenTehilim),
);
/** The cycles of the calendar: the Tehilim of the day go in the daily book. */
const cycles = computed(() =>
  CYCLE_CHOICES.filter(
    (cycle) =>
      cycle !== "tehilim-month" && cycle !== "tehilim-week" && !props.takenCycles.includes(cycle),
  ),
);
const habits = computed(() => HABITS.filter((preset) => !props.takenHabits.includes(preset)));
</script>

<template>
  <div>
    <!-- Read every day: one book for everything read again daily. -->
    <p class="create-lab create-lab-first">{{ t("parcours.create.readDaily") }}</p>
    <button
      type="button"
      class="press-feedback daily-book"
      :class="{ 'is-on': selected === 'text' }"
      :aria-current="selected === 'text' ? 'true' : undefined"
      data-tour="create-daily"
      @click="emit('text')"
    >
      <span class="daily-book-volume" aria-hidden="true">
        <ProgramVolume
          :color="bindingOf('tehilim')"
          :lines="[t('parcours.daily.title')]"
          :progress="0"
          format="small"
          :scale="0.5"
        />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block text-[16px] font-bold">
          {{ hasDailyBook ? t("parcours.create.dailyBookAdd") : t("parcours.create.dailyBook") }}
        </span>
        <span class="mt-0.5 block text-[13px] leading-snug opacity-80">
          {{ t("parcours.create.dailyBookHint") }}
        </span>
      </span>
      <AppIcon name="chevron-right" :size="16" class="flex-none rtl:rotate-180" />
    </button>

    <p class="create-lab">{{ t("parcours.create.finish") }}</p>
    <div
      class="books"
      data-tour="create-books"
      :class="{ 'has-choice': selected?.startsWith('program:') }"
    >
      <button
        v-for="corpus in corpora"
        :key="corpus"
        type="button"
        class="press-feedback book"
        :class="{ 'is-chosen': selected === `program:${corpus}` }"
        :aria-label="t(`parcours.corpus.${corpus}`)"
        :aria-current="selected === `program:${corpus}` ? 'true' : undefined"
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

    <template v-if="cycles.length">
      <p class="create-lab">{{ t("parcours.create.calendar") }}</p>
      <div class="flex flex-wrap gap-2" data-tour="create-cycles">
        <button
          v-for="cycle in cycles"
          :key="cycle"
          type="button"
          class="pick-pill"
          @click="emit('cycle', cycle)"
        >
          {{ t(`parcours.cycles.${cycle}.pick`) }}
        </button>
      </div>
    </template>

    <p class="create-lab">{{ t("parcours.create.habit") }}</p>
    <div class="flex flex-wrap gap-2" data-tour="create-habits">
      <button
        v-for="preset in habits"
        :key="preset"
        type="button"
        class="pick-pill"
        :class="{ 'is-on': selected === `habit:${preset}` }"
        :aria-current="selected === `habit:${preset}` ? 'true' : undefined"
        @click="emit('habit', preset)"
      >
        {{ t(`parcours.habits.${preset}`) }}
      </button>
      <button
        type="button"
        class="pick-pill pick-mine"
        :class="{ 'is-on': selected === 'habit:custom' }"
        :aria-current="selected === 'habit:custom' ? 'true' : undefined"
        @click="emit('habit', 'custom')"
      >
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
.create-lab-first {
  margin-top: 22px;
}
/* The daily book: one row, its volume standing at its start. */
.daily-book {
  display: flex;
  width: 100%;
  min-height: 76px;
  align-items: center;
  gap: 14px;
  padding: 10px 16px 10px 12px;
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  color: var(--color-text-primary);
  text-align: start;
}
.daily-book.is-on {
  background: var(--color-brand);
  box-shadow: none;
  color: var(--color-on-brand);
}
.daily-book-volume {
  display: block;
  flex: none;
  width: 34px;
}
.daily-book-volume :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}
/* The volumes standing on their plank. */
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
  transition:
    transform 0.25s ease,
    opacity 0.25s ease;
}
/* The chosen volume comes off the plank; the others stay, set back. */
.book.is-chosen {
  transform: translateY(-14px);
}
.has-choice .book:not(.is-chosen) {
  opacity: 0.55;
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
/* A choice that leads further: a pill set on the page. */
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
.pick-mine {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--color-line-strong);
  color: var(--color-primary);
}
/* What is set below: the color of the theme. */
.pick-pill.is-on {
  background: var(--color-brand);
  box-shadow: none;
  color: var(--color-on-brand);
}
@media (prefers-reduced-motion: reduce) {
  .book {
    transition: none;
  }
}
</style>
