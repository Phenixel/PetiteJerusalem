<script setup lang="ts">
/**
 * Ma journée : tout ce qu'il y a à faire un jour, rangé par moments, du matin
 * au coucher. On coche en glissant la ligne vers la droite (ou par sa case),
 * on met de côté vers la gauche (« Pas aujourd'hui »), on ouvre la page d'une
 * tâche en la touchant.
 *
 * La tête de page se glisse pour passer à la veille : un oubli d'hier se
 * coche après coup, sans détour par le mur.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import AppIcon from "../../components/icons/AppIcon.vue";
import TaskRow from "../../components/parcours/TaskRow.vue";
import DailyReminderButton from "../../components/parcours/DailyReminderButton.vue";
import { useParcours } from "../../composables/useParcours";
import { useParcoursMeta } from "../../composables/useParcoursMeta";
import { useParcoursViews, type TaskView } from "../../composables/useParcoursViews";
import { useSwipe } from "../../composables/useSwipe";
import { useWallLabels } from "../../composables/useWallLabels";
import { analyticsService } from "../../services/analyticsService";
import { localDayFrom } from "../../services/dateService";
import { dateTimeFormat } from "../../services/intlCache";
import { addDays, daysBetween, isDayKey, weekStart } from "../../services/parcours/days";
import type { DayKey, MomentId } from "../../services/parcours/model";
import { dayOrder, TIMED_MOMENTS } from "../../services/parcours/moments";
import { daySummaries } from "../../services/parcours/schedule";

useParcoursMeta("parcours.day.title", "/parcours/journee");

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const store = useParcours();
const views = useParcoursViews();
const labels = useWallLabels();

/** Le jour montré : celui de l'adresse, jamais après aujourd'hui. */
const day = computed<DayKey>(() => {
  const wanted = route.query.jour;
  const today = store.today.value;
  return typeof wanted === "string" && isDayKey(wanted) && wanted <= today ? wanted : today;
});

function goTo(next: DayKey): void {
  const today = store.today.value;
  if (next > today) return;
  void router.replace({ query: { ...route.query, jour: next === today ? undefined : next } });
}

const title = computed(() => {
  const offset = daysBetween(day.value, store.today.value);
  if (offset === 0) return t("parcours.day.today");
  if (offset === 1) return t("parcours.day.yesterday");
  const date = localDayFrom(day.value) ?? new Date();
  return dateTimeFormat(locale.value, { weekday: "long", day: "numeric", month: "long" }).format(
    date,
  );
});

const rows = computed<TaskView[]>(() =>
  store.tasksOn(day.value).map((task) => views.taskView(task, day.value)),
);
const doneCount = computed(() => rows.value.filter((row) => row.progress === "done").length);

/** Les moments de la journée, chacun avec ses tâches ; « dans la journée » en dernier. */
const groups = computed(() =>
  [...TIMED_MOMENTS, "anytime" as MomentId]
    .map((moment) => ({
      moment,
      rows: rows.value
        .filter((row) => row.task.moment === moment)
        .sort((a, b) => dayOrder(a.task.moment) - dayOrder(b.task.moment)),
    }))
    .filter((group) => group.rows.length > 0),
);

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

function toggle(view: TaskView, done: boolean, gesture: string): void {
  store.setDone(view.task, day.value, done);
  analyticsService.capture("parcours_task_marked", {
    done,
    kind: view.objective.kind,
    source: `journee_${gesture}`,
    days_ago: daysBetween(day.value, store.today.value),
  });
}

function skip(view: TaskView, skipped: boolean): void {
  store.setSkipped(view.task, day.value, skipped);
  analyticsService.capture("parcours_task_skipped", {
    skipped,
    kind: view.objective.kind,
    source: "journee",
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
  <main class="mx-auto w-full max-w-2xl px-4 py-8 md:px-6 md:py-12">
    <RouterLink to="/parcours" class="back-link mb-4">
      <AppIcon name="arrow-left" :size="14" class="rtl:rotate-180" />
      {{ t("parcours.title") }}
    </RouterLink>

    <header class="select-none" style="touch-action: pan-y" v-bind="header.listeners">
      <div class="flex items-center justify-between gap-2">
        <button
          type="button"
          class="icon-btn"
          :aria-label="t('parcours.day.previous')"
          @click="goTo(addDays(day, -1))"
        >
          <AppIcon name="chevron-left" :size="20" class="rtl:rotate-180" />
        </button>
        <h1 class="text-center font-display text-3xl font-bold first-letter:uppercase">
          {{ title }}
        </h1>
        <button
          type="button"
          class="icon-btn"
          :class="{ invisible: day === store.today.value }"
          :aria-label="t('parcours.day.next')"
          :disabled="day === store.today.value"
          @click="goTo(addDays(day, 1))"
        >
          <AppIcon name="chevron-right" :size="20" class="rtl:rotate-180" />
        </button>
      </div>
      <p v-if="rows.length" class="mt-1 text-center text-sm text-text-secondary">
        {{ t("parcours.day.count", { done: doneCount, total: rows.length }) }}
      </p>

      <div class="mt-5 grid grid-cols-7 gap-1" role="group" :aria-label="t('parcours.day.week')">
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

    <p v-if="day !== store.today.value" class="mt-5 text-center text-sm text-text-secondary">
      {{ t("parcours.day.pastHint") }}
    </p>

    <div v-if="groups.length" class="mt-6 space-y-6">
      <section v-for="group in groups" :key="group.moment">
        <h2 class="text-sm font-bold text-text-secondary">{{ views.momentLabel(group.moment) }}</h2>
        <div class="card mt-2 divide-y divide-line overflow-hidden">
          <TaskRow
            v-for="view in group.rows"
            :key="view.key"
            :view="view"
            swipe
            @toggle="(done) => toggle(view, done, 'row')"
            @skip="(skipped) => skip(view, skipped)"
          />
        </div>
      </section>
    </div>
    <div v-else class="mt-10 text-center">
      <p class="text-text-secondary">{{ t("parcours.day.empty") }}</p>
      <RouterLink to="/parcours/nouveau" class="btn btn-primary mt-4">
        {{ t("parcours.empty.cta") }}
      </RouterLink>
    </div>

    <DailyReminderButton class="mt-8" />
  </main>
</template>

<style scoped>
/* La semaine, en cases plates : c'est un choix de jour, pas le mur. */
.week-day {
  height: 36px;
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
    inset 22px 0 0 #e6cd9c;
  color: #5a4626;
}
.week-day.is-none {
  background: color-mix(in srgb, var(--color-text-primary) 7%, transparent);
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
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-text-primary) 18%, transparent);
  opacity: 0.6;
}
.week-day.is-shown {
  outline: 2px solid var(--color-text-primary);
  outline-offset: 2px;
}
</style>
