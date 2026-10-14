<script setup lang="ts">
/**
 * Un objectif ouvert. Un programme y dit où l'on en est (la position, la
 * piste de l'année), ce qu'il y a à lire aujourd'hui (la carte de la
 * portion : la toucher ouvre le texte, la glisser à droite la marque lue),
 * le retard et ce qu'il demande, et la semaine qui vient. Ses réglages sont
 * à côté (« Modifier »).
 *
 * Une habitude, une lecture du calendrier, un texte du jour s'y règlent
 * directement.
 */
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import AppIcon from "../../components/icons/AppIcon.vue";
import CatchUpSheet from "../../components/parcours/CatchUpSheet.vue";
import ObjectiveSettings from "../../components/parcours/ObjectiveSettings.vue";
import ProgramTimeline from "../../components/parcours/ProgramTimeline.vue";
import ProgramVolume from "../../components/parcours/ProgramVolume.vue";
import TaskCard from "../../components/parcours/TaskCard.vue";
import UnitCells from "../../components/parcours/UnitCells.vue";
import WeekBars from "../../components/parcours/WeekBars.vue";
import { useParcours } from "../../composables/useParcours";
import { useParcoursMeta } from "../../composables/useParcoursMeta";
import { useParcoursViews } from "../../composables/useParcoursViews";
import { useProgramWeek } from "../../composables/useProgramWeek";
import { useSwipe } from "../../composables/useSwipe";
import { useToast } from "../../composables/useToast";
import { analyticsService } from "../../services/analyticsService";
import type { ProgramObjective } from "../../services/parcours/model";
import { placeOf, unitLabel, unitOf } from "../../services/parcours/texts";

useParcoursMeta("parcours.objective.title", "/parcours");

const { t, locale } = useI18n();
const route = useRoute();
const toast = useToast();
const store = useParcours();
const views = useParcoursViews();
const week = useProgramWeek();

const objective = computed(() => {
  const found = store.data.value.objectives[String(route.params.id)];
  return found && found.deletedAt === undefined ? found : null;
});
const program = computed<ProgramObjective | null>(() =>
  objective.value?.kind === "program" ? objective.value : null,
);
const title = computed(() => (objective.value ? views.objectiveTitle(objective.value) : ""));

const plan = computed(() =>
  program.value ? store.context.value.plans.get(program.value.id) : undefined,
);
const state = computed(() => plan.value?.state(store.today.value) ?? null);
const position = computed(() => plan.value?.positionAt(store.today.value) ?? 0);
const unit = computed(() => (program.value ? unitOf(program.value.corpus) : "mishna"));
const finished = computed(() => program.value !== null && position.value >= program.value.total);

/** « Chabbat 7:1 » : là où l'on reprend. */
const here = computed(() => {
  if (!program.value) return "";
  const place = placeOf(program.value.texts, Math.min(position.value, program.value.total - 1));
  return place ? unitLabel(place, locale.value) : "";
});

const todayView = computed(() => {
  const task = store.todayTasks.value.find(
    (candidate) => candidate.objectiveId === program.value?.id,
  );
  return task ? views.taskView(task, store.today.value) : null;
});

/** Les unités lues aujourd'hui (ou cette semaine, au rythme hebdomadaire) dans la portion. */
function setRead(units: number): void {
  const p = program.value;
  const s = state.value;
  if (!p || !s) return;
  const todayUnits = store.data.value.days[store.today.value]?.units?.[p.id] ?? 0;
  const otherDays = s.done - todayUnits;
  store.setUnits(p.id, store.today.value, Math.max(0, units - otherDays));
  analyticsService.capture("parcours_units_marked", { units, source: "objective_cells" });
}

function markDone(done: boolean, gesture: string): void {
  const view = todayView.value;
  if (!view) return;
  store.setDone(view.task, store.today.value, done, `objective_${gesture}`);
  if (done) toast.success(t("parcours.program.doneToast"));
}

const card = useSwipe({
  x: true,
  onSwipe(direction) {
    if (direction === "right") markDone(true, "swipe");
  },
});
const cardStyle = computed(() =>
  card.dragging.value
    ? {
        transform: `translateX(${Math.max(0, card.dx.value)}px) rotate(${Math.max(0, card.dx.value) / 30}deg)`,
        transition: "none",
      }
    : {},
);

const bars = computed(() =>
  program.value
    ? week.bars(program.value, store.data.value.days, store.isRest.value, store.today.value)
    : [],
);

const catchingUp = ref(false);
</script>

<template>
  <main class="mx-auto w-full max-w-2xl px-4 py-8 md:px-6 md:py-12">
    <div class="flex items-center justify-between">
      <RouterLink to="/parcours" class="back-link">
        <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
        {{ t("parcours.title") }}
      </RouterLink>
      <RouterLink
        v-if="program"
        :to="`/parcours/objectif/${program.id}/reglages`"
        class="btn btn-soft btn-sm"
      >
        {{ t("common.edit") }}
      </RouterLink>
    </div>

    <p v-if="!objective" class="mt-16 text-center text-text-secondary">
      {{ t("parcours.objective.missing") }}
    </p>

    <!-- Un programme : où j'en suis, et ce qu'il y a à lire. -->
    <template v-else-if="program">
      <div class="mt-6 flex justify-center">
        <ProgramVolume
          v-bind="views.volumeOf(program)"
          :progress="position / Math.max(1, program.total)"
          :ribbon="todayView !== null && todayView.progress !== 'done'"
        />
      </div>
      <h1 class="mt-4 text-center font-display text-3xl font-bold">{{ title }}</h1>
      <template v-if="!finished">
        <p class="mt-3 text-center text-text-secondary">{{ t("parcours.program.here") }}</p>
        <p class="text-center font-display text-4xl font-bold">{{ here }}</p>
      </template>
      <p class="mt-1 text-center text-text-secondary">
        {{
          t("parcours.program.position", {
            done: position,
            total: views.unitsLabel(unit, program.total),
          })
        }}
      </p>
      <ProgramTimeline
        class="mt-6"
        :start="program.since"
        :end="program.end"
        :today="store.today.value"
        :done="position / Math.max(1, program.total)"
      />

      <!-- Fini : le siyoum. -->
      <section v-if="finished" class="card mt-8 px-5 py-6 text-center">
        <p class="font-display text-2xl font-bold">{{ t("parcours.program.finishedTitle") }}</p>
        <p class="mt-2 text-text-secondary">{{ t("parcours.program.finishedText") }}</p>
        <RouterLink to="/parcours/nouveau" class="btn btn-primary mt-4">{{
          t("parcours.links.new")
        }}</RouterLink>
      </section>

      <template v-else>
        <!-- La portion du jour : la toucher ouvre le texte, la glisser à droite la marque lue. -->
        <section class="mt-10">
          <div
            v-if="todayView"
            :style="cardStyle"
            style="touch-action: pan-y"
            v-bind="card.listeners"
          >
            <TaskCard :view="todayView" :tone="todayView.progress === 'done' ? 'done' : 'color'" />
          </div>
          <p v-else class="card px-4 py-4 text-center text-text-secondary">
            {{ t("parcours.program.nothingToday") }}
          </p>
          <template v-if="todayView && state">
            <UnitCells
              class="mt-4"
              :texts="program.texts"
              :from="state.from"
              :to="state.to"
              :read="state.done"
              @read="setRead"
            />
            <div class="mt-4 flex items-center justify-between gap-3">
              <p class="text-sm text-text-secondary">
                {{
                  t("parcours.program.time", {
                    time: views.portionTime(program, state.to - state.from),
                  })
                }}
              </p>
              <button
                type="button"
                class="btn btn-sm"
                :class="todayView.progress === 'done' ? 'btn-soft' : 'btn-primary'"
                @click="markDone(todayView.progress !== 'done', 'button')"
              >
                {{
                  todayView.progress === "done"
                    ? t("parcours.program.undo")
                    : t("parcours.program.done")
                }}
              </button>
            </div>
          </template>
        </section>

        <!-- Le retard, dit sans alarme. -->
        <section
          v-if="state && state.behind > 0"
          class="mt-8 flex items-center justify-between gap-3"
        >
          <p class="text-[15px] leading-snug">
            <span class="font-bold">{{
              t("parcours.program.behind", { units: views.unitsLabel(unit, state.behind) })
            }}</span>
            <br />
            <span class="text-text-secondary">{{ t("parcours.program.noRush") }}</span>
          </p>
          <button type="button" class="btn btn-soft flex-none" @click="catchingUp = true">
            {{ t("parcours.catchUp.open") }}
          </button>
        </section>

        <section class="mt-8">
          <h2 class="text-[15px] font-bold">
            {{
              program.rhythm === "weekly" ? t("parcours.program.weeks") : t("parcours.program.week")
            }}
          </h2>
          <WeekBars class="mt-3" :bars="bars" :label="t('parcours.program.weekLabel')" />
          <p class="mt-4 text-center text-[13px] text-text-secondary">
            {{ t("parcours.program.end", { date: views.dayLabel(program.end) }) }}
          </p>
        </section>
      </template>

      <CatchUpSheet :open="catchingUp" :program="program" @close="catchingUp = false" />
    </template>

    <!-- Une habitude, une lecture : ses réglages, directement. -->
    <template v-else>
      <h1 class="mt-6 text-center font-display text-3xl font-bold">{{ title }}</h1>
      <ObjectiveSettings class="mt-8" :objective="objective" />
    </template>
  </main>
</template>
