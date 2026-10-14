<script setup lang="ts">
/**
 * Nouvel objectif, en étapes : quoi, quelle partie, pour quand. Une habitude,
 * une lecture du calendrier ou un texte du jour vont plus vite.
 *
 * L'étape est dans l'adresse (`?etape=`), comme ce qu'on a déjà pris : le
 * retour du téléphone ramène à l'étape d'avant, sans rien perdre.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import AppIcon from "../../components/icons/AppIcon.vue";
import StepHabit from "../../components/parcours/create/StepHabit.vue";
import StepKind from "../../components/parcours/create/StepKind.vue";
import StepParts from "../../components/parcours/create/StepParts.vue";
import StepText from "../../components/parcours/create/StepText.vue";
import StepWhen from "../../components/parcours/create/StepWhen.vue";
import { useParcours } from "../../composables/useParcours";
import { useParcoursMeta } from "../../composables/useParcoursMeta";
import type { TextStudyJsonEntry } from "../../models/models";
import { analyticsService } from "../../services/analyticsService";
import { milestoneEve } from "../../services/parcours/calendar";
import {
  HABIT_DEFAULTS,
  PROGRAM_DEFAULT_MOMENT,
  createCycle,
  createHabit,
  createProgram,
  createText,
  cycleObjectiveId,
} from "../../services/parcours/create";
import {
  CYCLES,
  HABIT_PRESETS,
  isAlive,
  type CycleId,
  type DayKey,
  type HabitPreset,
  type MomentId,
  type Objective,
  type ProgramCorpus,
  type Rhythm,
} from "../../services/parcours/model";
import { resolveParts } from "../../services/parcours/texts";

useParcoursMeta("parcours.create.title", "/parcours/nouveau");

type Step = "kind" | "parts" | "when" | "habit" | "text";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const store = useParcours();

const CORPORA: ProgramCorpus[] = ["michna", "talmud", "tanakh", "tehilim"];

const step = computed<Step>(() => {
  const wanted = route.query.etape;
  if (wanted === "partie" && corpus.value && corpus.value !== "tehilim") return "parts";
  if (wanted === "quand" && corpus.value && parts.value.length) return "when";
  if (wanted === "habitude" && preset.value) return "habit";
  if (wanted === "texte") return "text";
  return "kind";
});
const corpus = computed<ProgramCorpus | null>(() => {
  const value = route.query.corpus;
  return CORPORA.includes(value as ProgramCorpus) ? (value as ProgramCorpus) : null;
});
const parts = computed<string[]>({
  get: () => {
    const value = route.query.parts;
    return typeof value === "string" && value ? value.split(",") : [];
  },
  set: (value) =>
    void router.replace({ query: { ...route.query, parts: value.join(",") || undefined } }),
});
const preset = computed<HabitPreset | null>(() => {
  const value = route.query.modele;
  return HABIT_PRESETS.includes(value as HabitPreset) ? (value as HabitPreset) : null;
});

function go(query: Record<string, string | undefined>): void {
  void router.push({ query });
}

// Le brouillon de l'étape « pour quand », et celui d'une habitude.
const end = ref<DayKey>(milestoneEve("roshHashana", store.today.value));
const rhythm = ref<Rhythm>("daily");
const programMoment = ref<MomentId>(PROGRAM_DEFAULT_MOMENT);
const habitName = ref("");
const habitDays = ref<number[]>([]);
const habitMoment = ref<MomentId>("anytime");

const stepTitle = computed(() => {
  switch (step.value) {
    case "parts":
      return t(`parcours.create.partsTitle.${corpus.value}`);
    case "when":
      return t("parcours.create.whenTitle");
    case "habit":
      return t(`parcours.habits.${preset.value}`);
    case "text":
      return t("parcours.create.dailyText");
    default:
      return t("parcours.create.title");
  }
});

const takenCycles = computed(() =>
  CYCLES.filter((cycle) => {
    const objective = store.data.value.objectives[cycleObjectiveId(cycle)];
    return objective !== undefined && isAlive(objective);
  }),
);
const takenTexts = computed(() =>
  Object.values(store.data.value.objectives)
    .filter((o) => o.kind === "text" && isAlive(o))
    .map((o) => (o.kind === "text" ? o.textId : 0)),
);

function chooseProgram(chosen: ProgramCorpus): void {
  // Les Tehilim se finissent en entier : pas de partie à choisir.
  if (chosen === "tehilim") go({ etape: "quand", corpus: chosen, parts: "all" });
  else go({ etape: "partie", corpus: chosen });
}

/** Le brouillon d'une habitude part des réglages de son modèle. */
function startHabit(chosen: HabitPreset): void {
  habitName.value = "";
  habitDays.value = [...HABIT_DEFAULTS[chosen].days];
  habitMoment.value = HABIT_DEFAULTS[chosen].moment;
}

function chooseHabit(chosen: HabitPreset): void {
  startHabit(chosen);
  go({ etape: "habitude", modele: chosen });
}

// Arrivé tout droit sur l'étape d'une habitude (une adresse rechargée) : ses réglages d'office.
watch(
  preset,
  (chosen) => {
    if (chosen && habitDays.value.length === 0) startHabit(chosen);
  },
  { immediate: true },
);

/** L'objectif créé : on le garde, on le compte, et l'on va le voir. */
function finish(objective: Objective, properties: Record<string, unknown>): void {
  store.saveObjective(objective);
  analyticsService.capture("parcours_objective_created", { kind: objective.kind, ...properties });
  void router.replace(`/parcours/objectif/${objective.id}`);
}

function createChosenProgram(): void {
  if (!corpus.value || resolveParts(corpus.value, parts.value).length === 0) return;
  const program = createProgram(
    {
      corpus: corpus.value,
      parts: parts.value,
      rhythm: rhythm.value,
      end: end.value,
      moment: programMoment.value,
    },
    store.today.value,
    Date.now(),
  );
  finish(program, {
    corpus: program.corpus,
    rhythm: program.rhythm,
    parts_count: program.parts.length,
    texts_count: program.texts.length,
  });
}

function createChosenHabit(): void {
  if (!preset.value) return;
  const habit = createHabit(
    {
      preset: preset.value,
      name: habitName.value,
      days: habitDays.value,
      moment: habitMoment.value,
    },
    store.today.value,
    Date.now(),
  );
  finish(habit, { preset: habit.preset, days_count: habit.days.length });
}

function createChosenCycle(cycle: CycleId): void {
  finish(createCycle(cycle, store.today.value, Date.now()), { cycle });
}

function createChosenText(entry: TextStudyJsonEntry): void {
  finish(createText(Number(entry.id), store.today.value, Date.now()), { text_id: entry.id });
}

const canGoOn = computed(
  () => corpus.value !== null && resolveParts(corpus.value, parts.value).length > 0,
);
</script>

<template>
  <main class="mx-auto w-full max-w-2xl px-4 py-8 md:px-6 md:py-12">
    <button v-if="step !== 'kind'" type="button" class="back-link mb-4" @click="router.back()">
      <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
      {{ t("common.back") }}
    </button>
    <RouterLink v-else to="/parcours" class="back-link mb-4">
      <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
      {{ t("parcours.title") }}
    </RouterLink>
    <h1 class="text-center font-display text-3xl font-bold leading-tight">{{ stepTitle }}</h1>

    <StepKind
      v-if="step === 'kind'"
      class="mt-8"
      :taken-cycles="takenCycles"
      @program="chooseProgram"
      @cycle="createChosenCycle"
      @text="go({ etape: 'texte' })"
      @habit="chooseHabit"
    />

    <template v-else-if="step === 'parts' && corpus">
      <StepParts v-model="parts" class="mt-6" :corpus="corpus" />
      <button
        type="button"
        class="btn btn-primary mt-8 w-full"
        :disabled="!canGoOn"
        @click="go({ ...route.query, etape: 'quand' } as Record<string, string>)"
      >
        {{ t("parcours.create.next") }}
      </button>
    </template>

    <StepWhen
      v-else-if="step === 'when' && corpus"
      v-model:end="end"
      v-model:rhythm="rhythm"
      v-model:moment="programMoment"
      class="mt-6"
      :corpus="corpus"
      :parts="parts"
      @create="createChosenProgram"
    />

    <StepHabit
      v-else-if="step === 'habit' && preset"
      v-model:name="habitName"
      v-model:days="habitDays"
      v-model:moment="habitMoment"
      class="mt-6"
      :preset="preset"
      @create="createChosenHabit"
    />

    <StepText
      v-else-if="step === 'text'"
      class="mt-6"
      :taken="takenTexts"
      @pick="createChosenText"
    />
  </main>
</template>
