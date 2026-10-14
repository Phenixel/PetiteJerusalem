<script setup lang="ts">
/**
 * Ma journée (P2-Journee) : le fil du jour. Chaque engagement est un nœud,
 * rangé par moment, du matin au coucher ; « Maintenant » dit où l'on en est.
 * Une ligne glissée à droite est faite ; à gauche, elle passe à plus tard,
 * ou n'est plus faite si elle l'était. Son lien l'ouvre (« Sidour »,
 * « Lire »).
 *
 * La tête de page se glisse : à droite, la veille ; à gauche, le jour
 * suivant. La semaine dessous, en cases plates, y mène d'un toucher : un
 * oubli d'hier se coche après coup, sans détour par le mur.
 */
import { HDate } from "@hebcal/core";
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import DailyReminderButton from "../../components/parcours/DailyReminderButton.vue";
import OfflineTextsNotice from "../../components/parcours/OfflineTextsNotice.vue";
import ParcoursBack from "../../components/parcours/ParcoursBack.vue";
import ThreadRow from "../../components/parcours/ThreadRow.vue";
import { useCurrentMoment } from "../../composables/useCurrentMoment";
import { useOfficeTimes } from "../../composables/useOfficeTimes";
import { useParcours } from "../../composables/useParcours";
import { useParcoursMeta } from "../../composables/useParcoursMeta";
import { useParcoursViews, type TaskView } from "../../composables/useParcoursViews";
import { useSwipe } from "../../composables/useSwipe";
import { useTodayDeck } from "../../composables/useTodayDeck";
import { useWallLabels } from "../../composables/useWallLabels";
import { useZmanimLocation } from "../../composables/useZmanimLocation";
import { analyticsService } from "../../services/analyticsService";
import { tehilimOfCycle } from "../../services/dailyCycles";
import { localDayFrom } from "../../services/dateService";
import { dateTimeFormat } from "../../services/intlCache";
import { addDays, isDayKey, weekStart } from "../../services/parcours/days";
import { isOwnHabit, type DayKey, type MomentId } from "../../services/parcours/model";
import { TIMED_MOMENTS } from "../../services/parcours/moments";
import { taskEntries } from "../../services/parcours/entries";
import { daySummaries } from "../../services/parcours/schedule";
import { haptic } from "../../services/haptics";
import { trackDayViewed } from "../../services/parcours/tracking";
import { formatHebrewDayMonth, isIsraelPlace } from "../../services/zmanimService";

useParcoursMeta("parcours.day.title", "/parcours/journee");

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const store = useParcours();
const views = useParcoursViews();
const labels = useWallLabels();
const offices = useOfficeTimes();
const moment = useCurrentMoment();
const deck = useTodayDeck();
const { place } = useZmanimLocation();

/** Le jour montré : celui de l'adresse, jamais après aujourd'hui. */
const day = computed<DayKey>(() => {
  const wanted = route.query.jour;
  const today = store.today.value;
  return typeof wanted === "string" && isDayKey(wanted) && wanted <= today ? wanted : today;
});
const isToday = computed(() => day.value === store.today.value);

function goTo(next: DayKey): void {
  const today = store.today.value;
  if (next > today) return;
  void router.replace({ query: { ...route.query, jour: next === today ? undefined : next } });
}

const date = computed(() => {
  const value = localDayFrom(day.value) ?? new Date();
  value.setHours(12);
  return value;
});
/** « Mardi 13 » : le jour de la semaine et son quantième. */
const weekdayLabel = computed(() =>
  dateTimeFormat(locale.value, { weekday: "long", day: "numeric" }).format(date.value),
);
const hebrewLabel = computed(() => formatHebrewDayMonth(new HDate(date.value), locale.value));

const rows = computed<TaskView[]>(() =>
  store.tasksOn(day.value).map((task) => views.taskView(task, day.value)),
);
const doneCount = computed(() => rows.value.filter((row) => row.progress === "done").length);
const countLabel = computed(() =>
  t("parcours.day.count", { done: doneCount.value, total: rows.value.length }),
);

/** Aujourd'hui : « Mardi 13 · 2 'Hechvan · 3 sur 8 » ; un autre jour : « 30 Tichri · 8 sur 8 ». */
const subtitle = computed(() =>
  [isToday.value ? weekdayLabel.value : "", hebrewLabel.value, countLabel.value]
    .filter(Boolean)
    .join(" · "),
);

/** Ce qu'une ligne dit sous son nom. */
function sub(view: TaskView): string {
  const { task, objective } = view;
  const during = t(`parcours.day.during.${task.moment}`);
  if (task.step) return (isToday.value && offices.officeMeta(task.step)) || during;
  if (objective.kind === "habit") return isOwnHabit(objective.preset) ? during : view.meta;
  if (objective.kind === "program") return views.portionText(task, objective);
  if (objective.kind === "cycle" && objective.cycle !== "parasha") {
    const psalms = tehilimOfCycle(objective.cycle, date.value).psalms;
    return psalms.length === 1
      ? t("parcours.day.psalm", { n: psalms[0] })
      : t("parcours.day.psalms", { from: psalms[0], to: psalms[psalms.length - 1] });
  }
  return view.meta;
}

interface Line {
  view: TaskView;
  sub: string;
  done: boolean;
  action: string;
}

function line(view: TaskView): Line {
  const done = view.progress === "done";
  const base = sub(view);
  const later = !done && isToday.value && deck.isLater(view);
  return {
    view,
    sub: done
      ? t("parcours.day.done", { sub: base })
      : later
        ? t("parcours.day.later", { sub: base })
        : base,
    done,
    action: view.task.step ? t("parcours.day.sidour") : t("parcours.day.read"),
  };
}

/** Le fil : les moments, chacun avec ses lignes ; « Maintenant » après le moment présent. */
const thread = computed(() => {
  const moments: MomentId[] = [...TIMED_MOMENTS, "anytime"];
  const groups = moments
    .map((m) => ({
      moment: m,
      lines: rows.value.filter((row) => row.task.moment === m).map(line),
    }))
    .filter((group) => group.lines.length > 0);
  const current = TIMED_MOMENTS.indexOf(moment.value);
  // « Maintenant » se pose avant le premier moment qui vient après le présent.
  const nowAt = isToday.value
    ? groups.findIndex((g) => g.moment === "anytime" || TIMED_MOMENTS.indexOf(g.moment) > current)
    : -2;
  return { groups, nowAt: nowAt === -1 ? groups.length : nowAt };
});

const nowLabel = computed(() => t("parcours.day.now", { time: offices.time(offices.now.value) }));

/** La semaine du jour montré, en cases plates : on y touche un jour pour y aller. */
const week = computed(() => {
  const start = weekStart(day.value);
  const initials = labels.weekdayInitials();
  return daySummaries(
    store.data.value,
    start,
    addDays(start, 6),
    store.today.value,
    store.context.value,
  ).map((summary, i) => ({ ...summary, initial: initials[i] }));
});

/** Ce qu'il faut sur l'appareil pour lire la journée d'aujourd'hui sans connexion. */
const entries = computed(() => {
  if (!isToday.value) return [];
  const il = isIsraelPlace(place.value);
  return rows.value.flatMap((row) => taskEntries(row.task, row.objective, day.value, il));
});

onMounted(() => trackDayViewed(store.data.value, store.context.value, store.today.value));

function toggle(view: TaskView, done: boolean): void {
  haptic(done ? "done" : "undo");
  store.setDone(view.task, day.value, done, "journee_row");
}

function later(view: TaskView): void {
  haptic("undo");
  deck.postpone(view);
  analyticsService.capture("parcours_task_postponed", {
    kind: view.task.kind,
    source: "journee_swipe",
  });
}

// La tête se glisse : à droite, la veille ; à gauche, le jour suivant.
const header = useSwipe({
  x: true,
  threshold: 70,
  onSwipe(direction) {
    if (direction === "right") goTo(addDays(day.value, -1));
    else if (direction === "left") goTo(addDays(day.value, 1));
  },
});
</script>

<template>
  <main class="mx-auto w-full max-w-2xl px-4 pb-10 pt-[18px] md:px-6 md:py-12">
    <ParcoursBack to="/" :label="t('parcours.day.back')" />

    <!-- La tête se glisse : à droite, la veille ; à gauche, le jour suivant. -->
    <header class="day-head" v-bind="header.listeners">
      <h1 class="mt-1 text-center text-[30px] font-bold first-letter:uppercase">
        {{ isToday ? t("parcours.day.today") : weekdayLabel }}
      </h1>
      <p class="mt-1 text-center text-sm text-text-secondary first-letter:uppercase">
        {{ subtitle }}
      </p>
      <div class="mt-[18px] flex gap-1" role="group" :aria-label="t('parcours.day.week')">
        <button
          v-for="summary in week"
          :key="summary.day"
          type="button"
          class="week-day"
          :class="[`is-${summary.status}`, { 'is-shown': summary.day === day }]"
          :disabled="summary.status === 'future'"
          :aria-pressed="summary.day === day"
          @click="goTo(summary.day)"
        >
          {{ summary.initial }}
        </button>
      </div>
    </header>

    <p v-if="!isToday" class="mt-4 text-center text-sm leading-normal">
      {{ t("parcours.day.pastHint") }}
    </p>

    <OfflineTextsNotice class="mt-6" :entries="entries" />

    <!-- Le fil : chaque engagement est un nœud ; « Maintenant » dit où l'on en est. -->
    <div v-if="thread.groups.length" class="thread mt-[22px]">
      <template v-for="(group, i) in thread.groups" :key="group.moment">
        <div v-if="i === thread.nowAt" class="thread-now">
          <i aria-hidden="true" />
          <span class="text-[13px] font-extrabold text-primary">{{ nowLabel }}</span>
        </div>
        <p class="thread-moment">{{ t(`parcours.day.moments.${group.moment}`) }}</p>
        <ThreadRow
          v-for="entry in group.lines"
          :key="entry.view.key"
          :title="entry.view.title"
          :sub="entry.sub"
          :done="entry.done"
          :route="entry.view.route"
          :action="entry.action"
          :can-later="isToday"
          @toggle="(done) => toggle(entry.view, done)"
          @later="later(entry.view)"
        />
      </template>
      <div v-if="thread.nowAt === thread.groups.length" class="thread-now">
        <i aria-hidden="true" />
        <span class="text-[13px] font-extrabold text-primary">{{ nowLabel }}</span>
      </div>
    </div>
    <div v-else class="mt-10 text-center">
      <p class="text-text-secondary">{{ t("parcours.day.empty") }}</p>
      <RouterLink to="/parcours/nouveau" class="btn btn-primary mt-4">
        {{ t("parcours.empty.cta") }}
      </RouterLink>
    </div>

    <p
      v-if="thread.groups.length"
      class="mt-[22px] text-center text-[13px] leading-normal text-text-secondary"
    >
      {{ t("parcours.day.footer") }}
    </p>

    <DailyReminderButton class="mt-8" />
  </main>
</template>

<style scoped>
.day-head {
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  cursor: grab;
}
/* La semaine, en cases plates : c'est un choix de jour, pas le mur. */
.week-day {
  flex: 1;
  height: 34px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-secondary);
}
.week-day.is-full {
  background: #e6cd9c;
  box-shadow: inset 0 0 0 3px #cfb07a;
  color: #5a4626;
}
.week-day.is-partial {
  background: #ece3d3;
  box-shadow:
    inset 0 0 0 3px #d6c4a2,
    inset 25px 0 0 #e6cd9c;
  color: #5a4626;
}
.week-day.is-none {
  background: color-mix(in srgb, var(--color-text-primary) 7%, transparent);
  box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.08);
}
.week-day.is-rest {
  background: #f4eee2;
  box-shadow: inset 0 0 0 3px #e2d9c6;
  color: #8a7f6c;
}
.week-day.is-today {
  box-shadow: inset 0 0 0 2px var(--color-primary);
  color: var(--color-primary);
}
.week-day.is-future,
.week-day.is-before {
  box-shadow: inset 0 0 0 1px var(--color-line-strong);
  opacity: 0.5;
  cursor: default;
}
.week-day.is-shown {
  outline: 2px solid var(--color-text-primary);
  outline-offset: 2px;
}

/* Le fil : une ligne verticale, qui passe sous les moments et sous
   « Maintenant », et que les lignes coupent de leurs nœuds. */
.thread {
  position: relative;
}
.thread-moment,
.thread-now {
  position: relative;
}
.thread-moment::before,
.thread-now::before {
  content: "";
  position: absolute;
  inset-inline-start: 21px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--color-line-strong);
}
.thread > :first-child::before {
  top: 8px;
}
.thread-moment {
  padding-block: 14px 4px;
  padding-inline-start: 48px;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-secondary);
}
/* Le soleil du fil : où l'on en est. */
.thread-now {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-block: 10px 4px;
  padding-inline-start: 11px;
}
.thread-now i {
  position: relative;
  z-index: 1;
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--color-primary) 18%, transparent);
}
</style>
