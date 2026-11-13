<script setup lang="ts">
/**
 * Un programme au jour, ouvert (P2-Programme) : le volume en grand, son
 * liseré doré tracé à mesure qu'on avance, où l'on en est, la piste de
 * l'année, puis la portion du jour, seule surface en couleur. La toucher
 * ouvre le texte (« Lire ») ; la glisser à droite la marque faite. Le retard
 * se dit sans alarme, la semaine qui vient en histogramme.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import { useParcoursViews } from "../../composables/useParcoursViews";
import { useProgramWeek } from "../../composables/useProgramWeek";
import { dragStyle, useSwipe } from "../../composables/useSwipe";
import { localDayFrom } from "../../services/dateService";
import { dateTimeFormat } from "../../services/intlCache";
import { milestoneEve, type Milestone } from "../../services/parcours/calendar";
import { addDays } from "../../services/parcours/days";
import type { ProgramObjective } from "../../services/parcours/model";
import { portionMinutes } from "../../services/parcours/plan";
import { placeOf, unitLabel, unitOf } from "../../services/parcours/texts";
import { haptic } from "../../services/haptics";
import ProgramTimeline from "./ProgramTimeline.vue";
import ProgramVolume from "./ProgramVolume.vue";
import ReadAhead from "./ReadAhead.vue";
import WeekBars from "./WeekBars.vue";

const props = defineProps<{ program: ProgramObjective }>();
const emit = defineEmits<{ (e: "catch-up"): void }>();

const { t, locale } = useI18n();
const store = useParcours();
const views = useParcoursViews();
const week = useProgramWeek();

const today = computed(() => store.today.value);
const unit = computed(() => unitOf(props.program.corpus));
const plan = computed(() => store.context.value.plans.get(props.program.id));
const state = computed(() => plan.value?.state(today.value) ?? null);
const position = computed(() => plan.value?.positionAt(today.value) ?? 0);

/** « Chabbat 7:1 » : là où l'on reprend. */
const here = computed(() => {
  const place = placeOf(props.program.texts, Math.min(position.value, props.program.total - 1));
  return place ? unitLabel(place, locale.value) : "";
});

const task = computed(
  () =>
    store.todayTasks.value.find((candidate) => candidate.objectiveId === props.program.id) ?? null,
);
const view = computed(() => (task.value ? views.taskView(task.value, today.value) : null));
const done = computed(() => view.value?.progress === "done");

/** La portion suivante, une fois celle du jour faite : « Demain mercredi : 7:4 à 8:1. » */
const next = computed(() => {
  for (let i = 1; i <= 14; i++) {
    const day = addDays(today.value, i);
    const found = store
      .tasksOn(day)
      .find((candidate) => candidate.objectiveId === props.program.id);
    if (!found) continue;
    const date = localDayFrom(day) ?? new Date();
    const weekday = dateTimeFormat(locale.value, { weekday: "long" }).format(date);
    return t(i === 1 ? "parcours.program.tomorrow" : "parcours.program.nextDay", {
      day: weekday,
      portion: views.portionText(found, props.program),
    });
  }
  return "";
});

const portion = computed(() => {
  const v = view.value;
  const s = state.value;
  if (!v || !task.value || !s) return null;
  if (done.value) {
    return {
      // « Ce soir, c'est fait », then what was read: « Portion faite » under
      // it said the same thing twice.
      kicker: t("parcours.program.doneKicker", { kicker: v.kicker }),
      title: views.portionText(task.value, props.program),
      sub: next.value,
    };
  }
  const units = Math.max(0, s.to - s.from);
  return {
    kicker: v.kicker,
    title: views.portionText(task.value, props.program),
    sub: t("parcours.program.portionSub", {
      units: views.unitsLabel(unit.value, units),
      minutes: portionMinutes(unit.value, units),
    }),
  };
});

function markDone(): void {
  if (!task.value || done.value) return;
  haptic("done");
  store.setDone(task.value, today.value, true, "objective_swipe");
}

// La portion glissée à droite : c'est fait.
const card = useSwipe({
  x: true,
  threshold: 110,
  onSwipe(direction) {
    if (direction === "right") markDone();
  },
});
const cardStyle = computed(() => (done.value ? {} : dragStyle(card, { right: true })));

/** Le retard, en jours au pas du programme : « Environ 4 jours. » */
const behindDays = computed(() => {
  const behind = state.value?.behind ?? 0;
  const average = Math.max(1, plan.value?.average ?? 1);
  return Math.max(1, Math.ceil(behind / average));
});

const bars = computed(() =>
  week.bars(props.program, store.data.value.days, store.isRest.value, today.value),
);

const MILESTONES: Milestone[] = ["roshHashana", "pessah"];

/** « Fin prévue le 29 Elul 5787 (1 octobre 2027), veille de Roch Hachana. » */
const endLabel = computed(() => {
  const end = props.program.end;
  const hebrew = views.dayLabel(end);
  const feast = MILESTONES.find((m) => milestoneEve(m, addDays(end, -1)) === end);
  return feast
    ? t("parcours.program.endEve", { date: hebrew, feast: t(`parcours.ends.${feast}`) })
    : t("parcours.program.end", { date: hebrew });
});
</script>

<template>
  <div>
    <!-- Le volume, en grand : le filet doré se trace à mesure qu'on avance. -->
    <div class="mt-2.5 flex justify-center">
      <ProgramVolume
        v-bind="views.volumeOf(program)"
        :progress="position / Math.max(1, program.total)"
        :ribbon="view !== null && !done"
        :scale="1.5625"
      />
    </div>
    <p class="mt-3.5 text-center text-[13px] font-semibold text-text-secondary">
      {{ t("parcours.program.here") }}
    </p>
    <p class="mt-0.5 text-center font-display text-[32px] font-bold leading-tight">{{ here }}</p>
    <p class="mt-1 text-center text-sm text-text-secondary">
      {{
        t("parcours.program.position", {
          done: position,
          total: views.unitsLabel(unit, program.total),
        })
      }}
    </p>

    <!-- L'année, du départ à la fin ; le trait, c'est le prévu. -->
    <ProgramTimeline
      class="mt-[26px]"
      :start="program.since"
      :end="program.end"
      :today="today"
      :done="position / Math.max(1, program.total)"
    />

    <!-- La portion du jour : la seule surface en couleur. -->
    <div
      v-if="portion"
      class="portion mt-[26px]"
      data-tour="program-portion"
      :class="{ 'is-done': done }"
      :style="cardStyle"
      v-bind="done ? {} : card.listeners"
    >
      <p class="text-[13px] font-semibold opacity-80">{{ portion.kicker }}</p>
      <p class="mt-1 text-2xl font-extrabold">{{ portion.title }}</p>
      <p class="mt-1 text-sm opacity-85">{{ portion.sub }}</p>
      <div v-if="!done" class="mt-4 flex items-center justify-between gap-2.5">
        <RouterLink v-if="view?.route" :to="view.route" class="btn portion-read" @pointerdown.stop>
          {{ t("parcours.program.read") }}
        </RouterLink>
        <span class="text-xs font-semibold opacity-70">{{ t("parcours.program.swipeHint") }}</span>
      </div>
    </div>
    <p v-else class="card mt-[26px] px-4 py-4 text-center text-text-secondary">
      {{ t("parcours.program.nothingToday") }}
    </p>

    <!-- Prendre de l'avance : la portion faite (ou aucune aujourd'hui), la suite se propose. -->
    <ReadAhead class="mt-[22px]" :program="program" :offer="done || !portion" />

    <!-- Le retard, dit sans alarme. -->
    <!-- En pause, pas de retard : la reprise recule la fin d'autant (resumeProgram). -->
    <div
      v-if="state && state.behind > 0 && !program.pausedFrom"
      class="mt-[22px] flex items-center justify-between gap-3"
    >
      <p class="text-[15px] leading-snug">
        <span class="font-bold">{{
          t("parcours.program.behind", { units: views.unitsLabel(unit, state.behind) })
        }}</span>
        <br />
        <span class="text-text-secondary">{{
          t("parcours.program.behindDays", { n: behindDays }, behindDays)
        }}</span>
      </p>
      <button
        type="button"
        class="btn btn-soft portion-btn flex-none"
        data-tour="program-catch-up"
        @click="emit('catch-up')"
      >
        {{ t("parcours.catchUp.open") }}
      </button>
    </div>

    <!-- La semaine qui vient, en histogramme : la charge de chaque jour. -->
    <p class="mt-[30px] text-[15px] font-bold">{{ t("parcours.program.week") }}</p>
    <WeekBars class="mt-3" :bars="bars" :label="t('parcours.program.weekLabel')" />
    <p class="mt-[18px] text-center text-[13px] text-text-secondary">{{ endLabel }}</p>
  </div>
</template>

<style scoped>
.portion {
  position: relative;
  padding: 18px;
  border-radius: var(--radius-card);
  background: var(--color-brand);
  color: var(--color-on-brand);
  box-shadow: var(--shadow-card);
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  cursor: grab;
  transition: transform 0.24s ease;
}
.portion.is-done {
  cursor: default;
}
/* « Lire », sur la couleur pleine : un voile de l'encre qui s'y écrit. */
.portion-read {
  min-height: 44px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 700;
  background: color-mix(in srgb, var(--color-on-brand) 14%, transparent);
  color: inherit;
}
.portion-btn {
  min-height: 44px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 700;
}
@media (prefers-reduced-motion: reduce) {
  .portion {
    transition: none;
  }
}
</style>
