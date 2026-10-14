<script setup lang="ts">
/**
 * Un programme à la semaine, ouvert (P2-Semaine) : la semaine où l'on en est
 * sur toutes celles du programme, la carte de la portion de la semaine (la
 * même que sur l'accueil : un toucher l'ouvre là où l'on en est, glissée à
 * droite la semaine est faite), puis où l'on en est dans la semaine, une
 * case par unité à toucher, et les semaines, une pierre chacune, nommées par
 * leur paracha.
 */
import { HDate } from "@hebcal/core";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useParcours } from "../../composables/useParcours";
import { useParcoursViews } from "../../composables/useParcoursViews";
import { useSwipe } from "../../composables/useSwipe";
import { useWallLabels } from "../../composables/useWallLabels";
import { analyticsService } from "../../services/analyticsService";
import { haptic } from "../../services/haptics";
import { localDayFrom } from "../../services/dateService";
import { addDays, daysBetween, weekOf } from "../../services/parcours/days";
import type { ProgramObjective } from "../../services/parcours/model";
import { portionMinutes } from "../../services/parcours/plan";
import { placeOf, unitLabel, unitOf } from "../../services/parcours/texts";
import { formatHebrewDate, hebrewMonthName } from "../../services/zmanimService";
import DeckArt from "./home/DeckArt.vue";
import UnitCells from "./UnitCells.vue";

const props = defineProps<{ program: ProgramObjective }>();
const emit = defineEmits<{ (e: "catch-up"): void }>();

const { t, locale } = useI18n();
const router = useRouter();
const store = useParcours();
const views = useParcoursViews();
const labels = useWallLabels();

const today = computed(() => store.today.value);
const unit = computed(() => unitOf(props.program.corpus));
const plan = computed(() => store.context.value.plans.get(props.program.id));
const state = computed(() => plan.value?.state(today.value) ?? null);
const position = computed(() => plan.value?.positionAt(today.value) ?? 0);
const progress = computed(() => position.value / Math.max(1, props.program.total));

const hebrewOf = (day: string): HDate => {
  const date = localDayFrom(day) ?? new Date();
  date.setHours(12);
  return new HDate(date);
};

/** « Séder Moed · à la semaine, depuis Tichri 5787 ». */
const heading = computed(() => {
  const hd = hebrewOf(props.program.since);
  const month = `${hebrewMonthName(hd.getMonth(), hd.getFullYear(), locale.value)} ${hd.getFullYear()}`;
  return t("parcours.program.weeklyHeading", {
    title: views.objectiveTitle(props.program),
    since: month,
  });
});

/** « Semaine 5 sur 55 ». */
const weekNumber = computed(() => {
  const first = weekOf(props.program.since);
  return {
    n: Math.floor(daysBetween(first, weekOf(today.value)) / 7) + 1,
    total: Math.floor(daysBetween(first, weekOf(props.program.end)) / 7) + 1,
  };
});

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

/** La portion de la semaine suivante, une fois celle-ci faite. */
const nextWeek = computed(() => {
  const day = addDays(weekOf(today.value), 1);
  const found = store.tasksOn(day).find((candidate) => candidate.objectiveId === props.program.id);
  return found ? views.portionText(found, props.program) : "";
});

const hero = computed(() => {
  const s = state.value;
  if (!s || !task.value) return null;
  if (done.value) {
    return {
      kicker: t("parcours.program.weekDoneKicker"),
      title: t("parcours.program.weekDone"),
      meta: nextWeek.value ? t("parcours.program.weekNext", { portion: nextWeek.value }) : "",
    };
  }
  return {
    kicker: t("parcours.program.weekKicker"),
    title: views.portionText(task.value, props.program),
    meta: t("parcours.program.weekRead", {
      done: s.done,
      total: views.unitsLabel(unit.value, Math.max(0, s.to - s.from)),
    }),
  };
});

function markDone(): void {
  if (!task.value || done.value) return;
  haptic("done");
  store.setDone(task.value, today.value, true, "objective_swipe");
}

const card = useSwipe({
  x: true,
  threshold: 110,
  onSwipe(direction) {
    if (direction === "right") markDone();
  },
});
const heroStyle = computed(() => {
  if (done.value || !card.dragging.value || card.axis.value !== "x") return {};
  const dx = Math.max(0, card.dx.value);
  return { transform: `translateX(${dx}px) rotate(${dx / 30}deg)`, transition: "none" };
});

function openHero(): void {
  if (view.value?.route) void router.push(view.value.route);
}

/** Les unités lues cette semaine, case par case. */
function setRead(units: number): void {
  const s = state.value;
  if (!s) return;
  const todayUnits = store.data.value.days[today.value]?.units?.[props.program.id] ?? 0;
  const otherDays = s.done - todayUnits;
  haptic("tick");
  store.setUnits(props.program.id, today.value, Math.max(0, units - otherDays));
  analyticsService.capture("parcours_units_marked", { units, source: "objective_cells" });
}

/** « Il reste 8 michnayot d'ici vendredi, environ 32 min. » */
const restLine = computed(() => {
  const s = state.value;
  if (!s) return "";
  const rest = Math.max(0, s.to - s.from - s.done);
  if (rest === 0) return t("parcours.program.weekAllRead");
  return t("parcours.program.weekRest", {
    units: views.unitsLabel(unit.value, rest),
    minutes: portionMinutes(unit.value, rest),
  });
});

/** Les semaines autour de celle-ci : quatre passées, celle-ci, trois à venir. */
const weeks = computed(() => {
  const current = weekOf(today.value);
  const first = weekOf(props.program.since);
  return Array.from({ length: 8 }, (_, i) => addDays(current, (i - 4) * 7))
    .filter((week) => week >= first && week <= weekOf(props.program.end))
    .map((week) => {
      const s = plan.value?.state(week);
      const n = Math.floor(daysBetween(first, week) / 7) + 1;
      let status: "full" | "partial" | "none" | "today" | "future" = "future";
      if (week === current) status = "today";
      else if (week < current) {
        status = s?.complete ? "full" : (s?.done ?? 0) > 0 ? "partial" : "none";
      }
      const look = `v${(n * 4 + 3) % 6} c${n % 4}`;
      return { week, n, label: labels.weekLabel(week), status, look };
    });
});

const behindDays = computed(() => {
  const behind = state.value?.behind ?? 0;
  return Math.max(1, Math.ceil(behind / Math.max(1, plan.value?.average ?? 1)));
});

const endLabel = computed(() =>
  t("parcours.program.end", {
    date: formatHebrewDate(hebrewOf(props.program.end), locale.value),
  }),
);
</script>

<template>
  <div>
    <p class="mt-3 text-center text-[13px] font-semibold text-text-secondary">{{ heading }}</p>
    <p class="mt-1 text-center font-display text-[34px] font-bold leading-tight">
      {{ t("parcours.program.weekOf", weekNumber) }}
    </p>
    <p class="mt-1 text-center text-sm text-text-secondary">
      {{
        t("parcours.program.weeklyCount", {
          done: position,
          total: views.unitsLabel(unit, program.total),
          here,
        })
      }}
    </p>

    <!-- La portion de la semaine : la même carte que sur l'accueil. -->
    <div
      v-if="hero"
      class="week-hero mt-11"
      role="link"
      tabindex="0"
      :style="heroStyle"
      v-bind="done ? {} : card.listeners"
      @click="openHero"
      @keydown.enter="openHero"
    >
      <DeckArt
        :art="{
          kind: 'volume',
          color: views.objectiveColor(program),
          label: views.coverLabel(program),
          progress,
        }"
      />
      <span class="hero-kick">{{ hero.kicker }}</span>
      <span class="hero-title">{{ hero.title }}</span>
      <span class="hero-meta">{{ hero.meta }}</span>
    </div>

    <template v-if="state && !done">
      <p class="mt-[26px] text-[15px] font-bold">{{ t("parcours.program.weekWhere") }}</p>
      <p class="mt-0.5 text-[13px] text-text-secondary">
        {{ t("parcours.program.weekWhereHint") }}
      </p>
      <UnitCells
        class="mt-3"
        :texts="program.texts"
        :from="state.from"
        :to="state.to"
        :read="state.done"
        @read="setRead"
      />
      <p class="mt-3 text-sm leading-normal">{{ restLine }}</p>
    </template>

    <!-- Les semaines, une pierre chacune, nommées par leur paracha. -->
    <p class="mt-[30px] text-[15px] font-bold">{{ t("parcours.program.weeks") }}</p>
    <div class="mt-3 flex">
      <div v-for="week in weeks" :key="week.week" class="week-cell">
        <span class="pj-stone week-stone" :class="[`is-${week.status}`, week.look]">
          {{ week.n }}
        </span>
        <span class="week-name">{{ week.label }}</span>
      </div>
    </div>

    <!-- Le retard, dit sans alarme. -->
    <div v-if="state && state.behind > 0" class="mt-[22px] flex items-center justify-between gap-3">
      <p class="text-[15px] leading-snug">
        <span class="font-bold">{{
          t("parcours.program.behind", { units: views.unitsLabel(unit, state.behind) })
        }}</span>
        <br />
        <span class="text-text-secondary">{{
          t("parcours.program.behindDays", { n: behindDays }, behindDays)
        }}</span>
      </p>
      <button type="button" class="btn btn-soft week-btn flex-none" @click="emit('catch-up')">
        {{ t("parcours.catchUp.open") }}
      </button>
    </div>

    <p class="mt-[22px] text-center text-[13px] leading-normal text-text-secondary">
      {{ endLabel }}
    </p>
  </div>
</template>

<style scoped>
/* La carte de la semaine : celle de l'accueil, aux mesures de la carte du Sidour. */
.week-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 124px;
  padding: 16px 20px 20px;
  border-radius: var(--radius-card);
  background: var(--color-brand);
  color: var(--color-on-brand);
  box-shadow: var(--shadow-card-hover);
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  cursor: pointer;
  transition: transform 0.24s ease;
}
.hero-kick {
  position: relative;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  opacity: 0.8;
}
.hero-title,
.hero-meta {
  position: relative;
  margin-top: 4px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.hero-title {
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 700;
  line-height: 1.25;
}
.hero-meta {
  font-size: 15px;
  font-weight: 500;
  opacity: 0.9;
}
.week-cell {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.week-stone {
  display: flex;
  width: 100%;
  height: 34px;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  cursor: default;
  --bevel: 4px;
}
.week-name {
  padding: 0 2px;
  text-align: center;
  font-size: 9.5px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--color-text-secondary);
}
.week-btn {
  min-height: 44px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 700;
}
@media (prefers-reduced-motion: reduce) {
  .week-hero {
    transition: none;
  }
}
</style>

<!-- Les pierres : partagées avec le mur (voir stones.css). -->
<style src="./stones.css"></style>
