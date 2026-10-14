<script setup lang="ts">
/**
 * Nouvel objectif, 1 (P2-Creer1) : que voulez-vous accomplir ? Finir un
 * texte (un volume à prendre sur la planche), suivre un cycle (les Tehilim
 * de la semaine ou du mois, la paracha ; un texte relu chaque jour), ou
 * prendre une habitude, d'un modèle ou avec ses mots.
 *
 * Un modèle déjà pris n'est plus proposé : on ne prend pas deux fois les
 * tefilot. Retiré de son parcours, il revient dans la liste. Le toucher
 * n'ajoute rien : il ouvre la feuille du modèle (PresetSheet), où l'on
 * confirme.
 *
 * Tout se fait sur la même page : ce qu'on a choisi reste marqué ici (le
 * volume sorti de la planche, la pastille en couleur), et la suite se
 * déplie dessous.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { bindingOf } from "../../../config/bindings";
import type { CycleId, HabitPreset, ProgramCorpus } from "../../../services/parcours/model";
import ProgramVolume from "../ProgramVolume.vue";

const props = defineProps<{
  /** Ce qu'on a choisi et qu'on règle plus bas : `program:michna`, `habit:custom`, `text`. */
  selected: string | null;
  takenCycles: CycleId[];
  takenHabits: HabitPreset[];
  /** Les Tehilim se finissent en entier : un seul programme à la fois. */
  takenTehilim: boolean;
}>();
const emit = defineEmits<{
  (e: "program", corpus: ProgramCorpus): void;
  (e: "cycle", cycle: CycleId): void;
  (e: "text"): void;
  (e: "habit", preset: HabitPreset): void;
}>();

const { t } = useI18n();

const CORPORA: ProgramCorpus[] = ["michna", "talmud", "tanakh", "tehilim"];
const CYCLES: CycleId[] = ["tehilim-week", "tehilim-month", "parasha"];
/**
 * Les modèles d'habitude : ce qui se fait chaque jour, sans moment trop
 * précis à tenir ; « Avec mes mots » ferme la liste. Les tefilin et Birkat
 * Hamazon n'y sont plus (les tefilot et le repas les portent déjà).
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
const cycles = computed(() => CYCLES.filter((cycle) => !props.takenCycles.includes(cycle)));
const habits = computed(() => HABITS.filter((preset) => !props.takenHabits.includes(preset)));
</script>

<template>
  <div>
    <p class="create-lab">{{ t("parcours.create.finish") }}</p>
    <div class="books" :class="{ 'has-choice': selected?.startsWith('program:') }">
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

    <p class="create-lab">{{ t("parcours.create.calendar") }}</p>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="cycle in cycles"
        :key="cycle"
        type="button"
        class="pick-pill"
        @click="emit('cycle', cycle)"
      >
        {{ t(`parcours.cycles.${cycle}.pick`) }}
      </button>
      <button
        type="button"
        class="pick-pill"
        :class="{ 'is-on': selected === 'text' }"
        :aria-current="selected === 'text' ? 'true' : undefined"
        @click="emit('text')"
      >
        {{ t("parcours.create.dailyText") }}
      </button>
    </div>

    <p class="create-lab">{{ t("parcours.create.habit") }}</p>
    <div class="flex flex-wrap gap-2">
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
  transition:
    transform 0.25s ease,
    opacity 0.25s ease;
}
/* Le volume choisi sort de la planche ; les autres restent, en retrait. */
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
.pick-mine {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--color-line-strong);
  color: var(--color-primary);
}
/* Ce qu'on règle plus bas : la couleur du thème. */
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
