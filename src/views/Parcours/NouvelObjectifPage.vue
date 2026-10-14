<script setup lang="ts">
/**
 * Nouvel objectif, en étapes (P2-Creer1 à 3, P2-Habitude) : quoi, quelle
 * partie, pour quand. Une habitude, un cycle ou un texte du jour vont plus
 * vite. L'étape se dit en haut à droite (« 2 sur 3 »).
 *
 * L'étape est dans l'adresse (`?etape=`), comme ce qu'on a déjà pris : le
 * retour du téléphone ramène à l'étape d'avant, sans rien perdre.
 *
 * Un modèle tout prêt (une habitude, un cycle) ne s'ajoute pas d'un toucher :
 * sa feuille dit ce qu'il demande, et l'on confirme (PresetSheet). On ne
 * prend pas deux fois le même : un modèle déjà pris n'est plus proposé, et
 * l'ajouter quand même (une adresse gardée, deux touchers) mène à celui
 * qu'on a déjà.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import ParcoursBack from "../../components/parcours/ParcoursBack.vue";
import PresetSheet, { type PresetChoice } from "../../components/parcours/create/PresetSheet.vue";
import StepHabit from "../../components/parcours/create/StepHabit.vue";
import StepKind from "../../components/parcours/create/StepKind.vue";
import StepParts from "../../components/parcours/create/StepParts.vue";
import StepText from "../../components/parcours/create/StepText.vue";
import StepWhen from "../../components/parcours/create/StepWhen.vue";
import { useParcours } from "../../composables/useParcours";
import { useParcoursMeta } from "../../composables/useParcoursMeta";
import { useParcoursViews } from "../../composables/useParcoursViews";
import type { TextStudyJsonEntry } from "../../models/models";
import { analyticsService } from "../../services/analyticsService";
import { haptic } from "../../services/haptics";
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
  type HabitAnchor,
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
const views = useParcoursViews();

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
const habitAnchor = ref<HabitAnchor | null>(null);
/** À la semaine : la carte vient le dimanche, le mercredi et le vendredi (P2-Creer3). */
const cardDays = ref<number[]>([0, 3, 5]);

const stepTitle = computed(() => {
  switch (step.value) {
    case "parts":
      return t(`parcours.create.partsTitle.${corpus.value}`);
    case "when": {
      const title = corpus.value
        ? views.objectiveTitle({
            kind: "program",
            corpus: corpus.value,
            parts: parts.value,
          } as Objective)
        : "";
      return t("parcours.create.whenTitle", { title });
    }
    case "habit":
      return t("parcours.create.habitTitle");
    case "text":
      return t("parcours.create.dailyText");
    default:
      return t("parcours.create.kindTitle");
  }
});

/** « 1 sur 3 » : où l'on en est des trois étapes d'un texte à finir. */
const stepCount = computed(() => {
  const n = { kind: 1, parts: 2, when: 3 }[step.value as "kind" | "parts" | "when"];
  return n ? t("parcours.create.stepOf", { n, total: 3 }) : "";
});

const takenCycles = computed(() =>
  CYCLES.filter((cycle) => {
    const objective = store.data.value.objectives[cycleObjectiveId(cycle)];
    return objective !== undefined && isAlive(objective);
  }),
);
/** Les modèles d'habitude déjà pris (« Avec mes mots » se prend autant qu'on veut). */
const takenHabits = computed(() =>
  Object.values(store.data.value.objectives).flatMap((o) =>
    o.kind === "habit" && o.preset !== "custom" && isAlive(o) ? [o.preset] : [],
  ),
);
/** Les programmes en cours d'un corpus : leurs textes ne se reprennent pas. */
const livePrograms = (of: ProgramCorpus) =>
  Object.values(store.data.value.objectives).flatMap((o) =>
    o.kind === "program" && o.corpus === of && isAlive(o) ? [o] : [],
  );
const takenTehilim = computed(() => livePrograms("tehilim").length > 0);
const takenProgramTexts = computed(() =>
  corpus.value ? livePrograms(corpus.value).flatMap((o) => o.texts) : [],
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
  habitAnchor.value = HABIT_DEFAULTS[chosen].anchor ?? null;
}

function chooseHabit(chosen: HabitPreset): void {
  startHabit(chosen);
  go({ etape: "habitude", modele: chosen });
}

/** Le modèle qu'on regarde, avant de le prendre. */
const presetChoice = ref<PresetChoice | null>(null);

function previewHabit(chosen: HabitPreset): void {
  // « Avec mes mots » demande un nom : son étape, directement.
  if (chosen === "custom") chooseHabit(chosen);
  else presetChoice.value = { kind: "habit", preset: chosen };
}

function addPreset(): void {
  const choice = presetChoice.value;
  presetChoice.value = null;
  if (choice?.kind === "cycle") createChosenCycle(choice.cycle);
  else if (choice?.kind === "habit") {
    startHabit(choice.preset);
    createChosenHabit(choice.preset);
  }
}

function adjustPreset(): void {
  const choice = presetChoice.value;
  presetChoice.value = null;
  if (choice?.kind === "habit") chooseHabit(choice.preset);
}

/** Un modèle déjà pris : on va voir celui qu'on a, au lieu d'en prendre un second. */
function alreadyTaken(found: Objective | undefined): boolean {
  if (!found) return false;
  void router.replace(`/parcours/objectif/${found.id}`);
  return true;
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
  haptic("done");
  store.saveObjective(objective);
  analyticsService.capture("parcours_objective_created", { kind: objective.kind, ...properties });
  void router.replace(`/parcours/objectif/${objective.id}`);
}

function createChosenProgram(): void {
  if (!corpus.value || resolveParts(corpus.value, parts.value).length === 0) return;
  const chosen = [...parts.value].sort().join();
  const same = livePrograms(corpus.value).find((o) => [...o.parts].sort().join() === chosen);
  if (alreadyTaken(same)) return;
  const program = createProgram(
    {
      corpus: corpus.value,
      parts: parts.value,
      rhythm: rhythm.value,
      end: end.value,
      moment: programMoment.value,
      cardDays: cardDays.value,
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

function createChosenHabit(chosen: HabitPreset | null = preset.value): void {
  if (!chosen) return;
  if (
    chosen !== "custom" &&
    alreadyTaken(
      Object.values(store.data.value.objectives).find(
        (o) => o.kind === "habit" && o.preset === chosen && isAlive(o),
      ),
    )
  ) {
    return;
  }
  const habit = createHabit(
    {
      preset: chosen,
      name: habitName.value,
      days: habitDays.value,
      moment: habitMoment.value,
      anchor: habitAnchor.value ?? undefined,
    },
    store.today.value,
    Date.now(),
  );
  finish(habit, { preset: habit.preset, days_count: habit.days.length });
}

function createChosenCycle(cycle: CycleId): void {
  const found = store.data.value.objectives[cycleObjectiveId(cycle)];
  if (found && isAlive(found) && alreadyTaken(found)) return;
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
  <main class="mx-auto w-full max-w-2xl px-4 pb-8 pt-[18px] md:px-6 md:py-12">
    <div class="flex items-center justify-between">
      <ParcoursBack v-if="step !== 'kind'" :label="t('common.back')" />
      <ParcoursBack v-else to="/parcours" :label="t('parcours.title')" />
      <span v-if="stepCount" class="text-[13px] font-semibold text-text-secondary">
        {{ stepCount }}
      </span>
    </div>
    <h1 class="mt-3.5 font-display text-[30px] font-bold leading-tight">{{ stepTitle }}</h1>

    <StepKind
      v-if="step === 'kind'"
      :taken-cycles="takenCycles"
      :taken-habits="takenHabits"
      :taken-tehilim="takenTehilim"
      @program="chooseProgram"
      @cycle="(cycle) => (presetChoice = { kind: 'cycle', cycle })"
      @text="go({ etape: 'texte' })"
      @habit="previewHabit"
    />

    <template v-else-if="step === 'parts' && corpus">
      <StepParts v-model="parts" class="mt-6" :corpus="corpus" :taken="takenProgramTexts" />
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
      v-model:card-days="cardDays"
      :corpus="corpus"
      :parts="parts"
      @create="createChosenProgram"
    />

    <StepHabit
      v-else-if="step === 'habit' && preset"
      v-model:name="habitName"
      v-model:days="habitDays"
      v-model:moment="habitMoment"
      v-model:anchor="habitAnchor"
      :preset="preset"
      @create="createChosenHabit()"
    />

    <StepText
      v-else-if="step === 'text'"
      class="mt-6"
      :taken="takenTexts"
      @pick="createChosenText"
    />

    <PresetSheet
      :choice="presetChoice"
      @close="presetChoice = null"
      @add="addPreset"
      @adjust="adjustPreset"
    />
  </main>
</template>
