<script setup lang="ts">
/**
 * Nouvel objectif (P2-Creer1 à 3, P2-Habitude), sur une seule page : on
 * choisit en haut (un volume, un cycle, une habitude), et la suite se
 * déplie dessous, la page glissant jusqu'à elle : quelle partie, puis
 * « d'ici quand ? » ; ou l'habitude à régler ; ou le texte à chercher. Ce
 * qu'on a choisi reste marqué en haut, et se change sans revenir en
 * arrière.
 *
 * Le choix vit dans la page, pas dans l'adresse : la changer ramènerait la
 * page en haut (router/index.ts), au lieu de la laisser glisser vers la
 * section. Une adresse qui en porte un (`?modele=`, `?corpus=`, `?parts=`,
 * `?etape=texte`) l'ouvre à l'arrivée, puis s'efface.
 *
 * Un modèle tout prêt (une habitude, un cycle) ne s'ajoute pas d'un toucher :
 * sa feuille dit ce qu'il demande, et l'on confirme (PresetSheet). On ne
 * prend pas deux fois le même : un modèle déjà pris n'est plus proposé, et
 * l'ajouter quand même (une adresse gardée, deux touchers) mène à celui
 * qu'on a déjà.
 *
 * Créé, l'objectif part sur Mon parcours, où il arrive sous les yeux (voir
 * useParcoursArrival).
 */
import { computed, nextTick, ref, watch, type Ref } from "vue";
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
import { arriveOnParcours } from "../../composables/useParcoursArrival";
import { useParcoursMeta } from "../../composables/useParcoursMeta";
import { useParcoursViews } from "../../composables/useParcoursViews";
import type { TextStudyJsonEntry } from "../../models/models";
import { analyticsService } from "../../services/analyticsService";
import { haptic } from "../../services/haptics";
import { prefersLessMotion } from "../../composables/useMotion";
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
  CYCLE_CHOICES,
  HABIT_PRESETS,
  isAlive,
  type CycleChoice,
  type DayKey,
  type HabitAnchor,
  type HabitPreset,
  type MomentId,
  type Objective,
  type ProgramCorpus,
  type ProgramPart,
  type Rhythm,
} from "../../services/parcours/model";
import { resolveParts } from "../../services/parcours/texts";

useParcoursMeta("parcours.create.title", "/parcours/nouveau");

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const store = useParcours();
const views = useParcoursViews();

const CORPORA: ProgramCorpus[] = ["michna", "talmud", "tanakh", "tehilim"];

/** Ce qu'on a choisi en haut : ce qui se déplie dessous. */
type Selection =
  | { kind: "program"; corpus: ProgramCorpus }
  | { kind: "habit"; preset: HabitPreset }
  | { kind: "text" };

/** Le choix porté par l'adresse d'arrivée. */
function initialSelection(): Selection | null {
  const { modele, corpus, etape } = route.query;
  if (HABIT_PRESETS.includes(modele as HabitPreset)) {
    return { kind: "habit", preset: modele as HabitPreset };
  }
  if (CORPORA.includes(corpus as ProgramCorpus)) {
    return { kind: "program", corpus: corpus as ProgramCorpus };
  }
  return etape === "texte" ? { kind: "text" } : null;
}

const selection = ref<Selection | null>(initialSelection());
const corpus = computed(() =>
  selection.value?.kind === "program" ? selection.value.corpus : null,
);
const preset = computed(() => (selection.value?.kind === "habit" ? selection.value.preset : null));

/** `program:michna`, `habit:custom`, `text` : ce que le haut de la page marque. */
const selectedKey = computed(() => {
  const chosen = selection.value;
  if (!chosen) return null;
  if (chosen.kind === "program") return `program:${chosen.corpus}`;
  return chosen.kind === "habit" ? `habit:${chosen.preset}` : "text";
});

const parts = ref<ProgramPart[]>(
  corpus.value === "tehilim"
    ? ["all"]
    : typeof route.query.parts === "string" && route.query.parts
      ? route.query.parts.split(",")
      : [],
);
/** « D'ici quand ? » déplié : par « Suivant », ou d'emblée pour les Tehilim. */
const whenOpen = ref(
  (route.query.etape === "quand" && parts.value.length > 0) || corpus.value === "tehilim",
);

// L'adresse a dit ce qu'elle avait à dire : elle s'efface.
if (Object.keys(route.query).length) void router.replace({ query: {} });

// Les sections qui se déplient, et la page qui glisse jusqu'à elles.
const partsSection = ref<HTMLElement | null>(null);
const whenSection = ref<HTMLElement | null>(null);
const habitSection = ref<HTMLElement | null>(null);
const textSection = ref<HTMLElement | null>(null);

async function reveal(section: Ref<HTMLElement | null>): Promise<void> {
  await nextTick();
  section.value?.scrollIntoView({
    behavior: prefersLessMotion() ? "auto" : "smooth",
    block: "start",
  });
}

// Le brouillon de « d'ici quand ? », et celui d'une habitude.
const end = ref<DayKey>(milestoneEve("roshHashana", store.today.value));
const rhythm = ref<Rhythm>("daily");
const programMoment = ref<MomentId>(PROGRAM_DEFAULT_MOMENT);
/** Le soir, après Arvit : le moment d'un programme qu'on vient de créer. */
const programAnchor = ref<HabitAnchor | null>("arvit");
const habitName = ref("");
const habitDays = ref<number[]>([]);
const habitMoment = ref<MomentId>("anytime");
const habitAnchor = ref<HabitAnchor | null>(null);
/** À la semaine : la carte vient le dimanche, le mercredi et le vendredi (P2-Creer3). */
const cardDays = ref<number[]>([0, 3, 5]);

const whenTitle = computed(() => {
  const title = corpus.value
    ? views.objectiveTitle({
        kind: "program",
        corpus: corpus.value,
        parts: parts.value,
      } as Objective)
    : "";
  return t("parcours.create.whenTitle", { title });
});

/** Le nom du modèle qu'on règle ; « Une habitude » pour la sienne. */
const habitTitle = computed(() =>
  preset.value && preset.value !== "custom"
    ? t(`parcours.habits.${preset.value}`)
    : t("parcours.create.habitTitle"),
);

// La paracha se suit d'une façon ou de l'autre : prise, ses deux choix s'éteignent.
const takenCycles = computed(() =>
  CYCLE_CHOICES.filter((cycle) => {
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
  if (corpus.value !== chosen) {
    selection.value = { kind: "program", corpus: chosen };
    // Les Tehilim se finissent en entier : pas de partie à choisir.
    parts.value = chosen === "tehilim" ? ["all"] : [];
    whenOpen.value = chosen === "tehilim";
  }
  void reveal(chosen === "tehilim" ? whenSection : partsSection);
}

function openWhen(): void {
  whenOpen.value = true;
  void reveal(whenSection);
}

function chooseText(): void {
  selection.value = { kind: "text" };
  void reveal(textSection);
}

/** Le brouillon d'une habitude part des réglages de son modèle. */
function startHabit(chosen: HabitPreset): void {
  habitName.value = "";
  habitDays.value = [...HABIT_DEFAULTS[chosen].days];
  habitMoment.value = HABIT_DEFAULTS[chosen].moment;
  habitAnchor.value = HABIT_DEFAULTS[chosen].anchor ?? null;
}

function chooseHabit(chosen: HabitPreset): void {
  if (preset.value !== chosen) {
    startHabit(chosen);
    selection.value = { kind: "habit", preset: chosen };
  }
  void reveal(habitSection);
}

/** Le modèle qu'on regarde, avant de le prendre. */
const presetChoice = ref<PresetChoice | null>(null);

function previewHabit(chosen: HabitPreset): void {
  // « Avec mes mots » demande un nom : il se règle, directement.
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

// Arrivé avec une habitude dans l'adresse (un rechargement) : ses réglages d'office.
watch(
  preset,
  (chosen) => {
    if (chosen && habitDays.value.length === 0) startHabit(chosen);
  },
  { immediate: true },
);

/** L'objectif créé : on le garde, on le compte, et il arrive sur Mon parcours. */
function finish(objective: Objective, properties: Record<string, unknown>): void {
  haptic("done");
  store.saveObjective(objective);
  analyticsService.capture("parcours_objective_created", { kind: objective.kind, ...properties });
  arriveOnParcours(router, objective.id);
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
      anchor: programAnchor.value,
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

function createChosenCycle(cycle: CycleChoice): void {
  const found = store.data.value.objectives[cycleObjectiveId(cycle)];
  if (found && isAlive(found) && alreadyTaken(found)) return;
  finish(createCycle(cycle, store.today.value, Date.now()), { cycle });
}

/** Les textes du jour cochés, pris d'un coup ; Mon parcours glisse jusqu'au premier. */
function createChosenTexts(entries: TextStudyJsonEntry[]): void {
  if (entries.length === 0) return;
  haptic("done");
  const now = Date.now();
  const created = entries.map((entry, i) =>
    createText(Number(entry.id), store.today.value, now + i),
  );
  for (const objective of created) {
    store.saveObjective(objective);
    analyticsService.capture("parcours_objective_created", {
      kind: "text",
      text_id: objective.textId,
      texts_count: created.length,
    });
  }
  arriveOnParcours(router, created[0].id);
}

const canGoOn = computed(
  () => corpus.value !== null && resolveParts(corpus.value, parts.value).length > 0,
);
</script>

<template>
  <main class="mx-auto w-full max-w-2xl px-4 pb-8 pt-[18px] md:px-6 md:py-12">
    <ParcoursBack to="/parcours" :label="t('parcours.title')" />
    <h1 class="mt-3.5 font-display text-[30px] font-bold leading-tight">
      {{ t("parcours.create.kindTitle") }}
    </h1>

    <StepKind
      :selected="selectedKey"
      :taken-cycles="takenCycles"
      :taken-habits="takenHabits"
      :taken-tehilim="takenTehilim"
      @program="chooseProgram"
      @cycle="(cycle) => (presetChoice = { kind: 'cycle', cycle })"
      @text="chooseText"
      @habit="previewHabit"
    />

    <!-- Quelle partie : les sedarim sur leur planche, ou les livres. -->
    <section
      v-if="corpus && corpus !== 'tehilim'"
      ref="partsSection"
      :key="`parts-${corpus}`"
      class="create-section"
    >
      <h2 class="create-h2">{{ t(`parcours.create.partsTitle.${corpus}`) }}</h2>
      <StepParts v-model="parts" class="mt-4" :corpus="corpus" :taken="takenProgramTexts" />
      <button
        v-if="!whenOpen"
        type="button"
        class="btn btn-primary mt-8 w-full"
        :disabled="!canGoOn"
        @click="openWhen"
      >
        {{ t("parcours.create.next") }}
      </button>
    </section>

    <!-- D'ici quand : la date, le rythme, le moment. -->
    <section v-if="corpus && whenOpen && canGoOn" ref="whenSection" class="create-section">
      <h2 class="create-h2">{{ whenTitle }}</h2>
      <StepWhen
        v-model:end="end"
        v-model:rhythm="rhythm"
        v-model:moment="programMoment"
        v-model:anchor="programAnchor"
        v-model:card-days="cardDays"
        :corpus="corpus"
        :parts="parts"
        @create="createChosenProgram"
      />
    </section>

    <!-- Une habitude : son nom, ses jours, son moment. -->
    <section v-if="preset" ref="habitSection" :key="`habit-${preset}`" class="create-section">
      <h2 class="create-h2">{{ habitTitle }}</h2>
      <StepHabit
        v-model:name="habitName"
        v-model:days="habitDays"
        v-model:moment="habitMoment"
        v-model:anchor="habitAnchor"
        :preset="preset"
        @create="createChosenHabit()"
      />
    </section>

    <!-- Un texte chaque jour : on le cherche, on le prend. -->
    <section v-if="selection?.kind === 'text'" ref="textSection" class="create-section">
      <h2 class="create-h2">{{ t("parcours.create.dailyText") }}</h2>
      <StepText class="mt-4" :taken="takenTexts" @pick="createChosenTexts" />
    </section>

    <PresetSheet
      :choice="presetChoice"
      @close="presetChoice = null"
      @add="addPreset"
      @adjust="adjustPreset"
    />
  </main>
</template>

<style scoped>
/* Une section dépliée sous le choix : un filet la sépare, elle monte à peine. */
.create-section {
  margin-top: 36px;
  padding-top: 26px;
  border-top: 1px solid var(--color-line);
  /* Son titre se pose sous l'en-tête collant du site ; l'app n'a que la barre d'état. */
  scroll-margin-top: 76px;
  animation: section-unfolds 0.32s ease-out both;
}
@media (min-width: 768px) {
  .create-section {
    scroll-margin-top: 100px;
  }
}
:root.native-app .create-section {
  scroll-margin-top: calc(env(safe-area-inset-top, 0px) + 16px);
}
.create-h2 {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
}
@keyframes section-unfolds {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .create-section {
    animation: none;
  }
}
:root.perf-lite .create-section {
  animation: none;
}
</style>
