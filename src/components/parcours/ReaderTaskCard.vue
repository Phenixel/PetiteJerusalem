<script setup lang="ts">
/**
 * At the bottom of a reading opened from Mon parcours (`?objectif=`), the end
 * of the day's portion (P2-Lecteur): « Fin de la portion du jour », and the
 * ring pulled upward to mark it done (PullToMark, shared with the end of a
 * service's text): the portion is done, the bookmark has moved on.
 * « Annuler » undoes it.
 *
 * Elle suit la lecture d'un chapitre à l'autre : l'adresse garde l'objectif.
 *
 * Prendre de l'avance (`?avance=1`, « Lire la suite ») : la lecture est la
 * portion d'après (`nextPortion`), et l'anneau la marque lue aujourd'hui.
 * Une portion faite propose de même « Lire la suite ».
 *
 * Chargée à la demande (voir TextReadingPage) : elle tire le calendrier
 * hébraïque.
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { useParcours } from "../../composables/useParcours";
import { useParcoursViews } from "../../composables/useParcoursViews";
import { analyticsService } from "../../services/analyticsService";
import { haptic } from "../../services/haptics";
import { addDays } from "../../services/parcours/days";
import PullToMark from "./PullToMark.vue";

const props = defineProps<{ objectiveId: string }>();

const { t } = useI18n();
const route = useRoute();
const store = useParcours();
const views = useParcoursViews();

const task = computed(
  () =>
    store.todayTasks.value.find((candidate) => candidate.objectiveId === props.objectiveId) ?? null,
);
const view = computed(() => (task.value ? views.taskView(task.value, store.today.value) : null));

const program = computed(() => {
  const objective = store.data.value.objectives[props.objectiveId];
  return objective?.kind === "program" && objective.deletedAt === undefined ? objective : null;
});

/** En avance : la lecture est la suite, pas la portion du jour. */
const ahead = computed(() => route.query.avance === "1" && program.value !== null);

/** La suite lue en avance : figée une fois marquée, la suivante prenant sa place. */
const marked = ref<{ from: number; to: number } | null>(null);
// « Lire la suite » mène à la portion d'après (un autre chapitre, ou une
// autre michna du même) : la carte repart sur elle.
watch(
  () => route.fullPath,
  () => {
    marked.value = null;
  },
);
const aheadRange = computed(
  () =>
    marked.value ??
    (ahead.value && program.value ? views.nextPortionOf(program.value, store.today.value) : null),
);
const aheadText = computed(() =>
  program.value && aheadRange.value
    ? views.rangeText(program.value, aheadRange.value.from, aheadRange.value.to)
    : "",
);

const done = computed(() =>
  ahead.value ? marked.value !== null : view.value?.progress === "done",
);

/** « Lire la suite » : la portion d'après, une fois celle-ci faite. */
const nextAhead = computed(() =>
  done.value && program.value ? views.aheadRoute(program.value, store.today.value) : null,
);

/** La portion suivante : « Demain, 7:4 à 8:1. Le signet a avancé. » */
const next = computed(() => {
  const objective = view.value?.objective;
  if (!objective || objective.kind !== "program") return t("parcours.reader.doneSub");
  for (let i = 1; i <= 14; i++) {
    const day = addDays(store.today.value, i);
    const found = store.tasksOn(day).find((candidate) => candidate.objectiveId === objective.id);
    if (found) {
      return t("parcours.reader.next", { portion: views.portionText(found, objective) });
    }
  }
  return t("parcours.reader.doneSub");
});

const label = computed(() => ({
  pull: t("parcours.reader.pull"),
  release: t("parcours.reader.release"),
  done: ahead.value ? t("parcours.reader.aheadDone") : t("parcours.reader.done"),
}));
const sub = computed(() => ({
  pull: ahead.value ? t("parcours.reader.aheadPullSub") : t("parcours.reader.pullSub"),
  release: ahead.value ? t("parcours.reader.aheadReleaseSub") : t("parcours.reader.releaseSub"),
  done: ahead.value ? t("parcours.reader.aheadDoneSub") : next.value,
}));

/** Les unités du programme lues aujourd'hui. */
const readToday = (): number =>
  store.data.value.days[store.today.value]?.units?.[props.objectiveId] ?? 0;

function markDone(): void {
  if (done.value) return;
  if (ahead.value) {
    const range = aheadRange.value;
    if (!range || !program.value) return;
    haptic("done");
    marked.value = range;
    store.setUnits(props.objectiveId, store.today.value, readToday() + range.to - range.from);
    analyticsService.capture("parcours_read_ahead", {
      corpus: program.value.corpus,
      units: range.to - range.from,
    });
    return;
  }
  if (!task.value) return;
  haptic("done");
  store.setDone(task.value, store.today.value, true, "reader");
}

function undo(): void {
  if (ahead.value) {
    const range = marked.value;
    if (!range) return;
    haptic("undo");
    store.setUnits(
      props.objectiveId,
      store.today.value,
      Math.max(0, readToday() - (range.to - range.from)),
    );
    marked.value = null;
    return;
  }
  if (!task.value) return;
  haptic("undo");
  store.setDone(task.value, store.today.value, false, "reader");
}
</script>

<template>
  <PullToMark
    v-if="ahead ? aheadRange : view"
    :done="done"
    :heading="
      ahead ? t('parcours.reader.aheadEnd', { portion: aheadText }) : t('parcours.reader.end')
    "
    :aria="ahead ? t('parcours.reader.aheadAria') : t('parcours.reader.aria')"
    :label="label"
    :sub="sub"
    @mark="markDone"
  >
    <!-- Prendre de l'avance : la portion d'après, marquée lue aujourd'hui. -->
    <RouterLink
      v-if="nextAhead"
      :to="nextAhead"
      class="btn btn-soft min-h-11 px-4 text-[15px] font-bold"
    >
      {{ t("parcours.reader.readAhead") }}
    </RouterLink>
    <RouterLink to="/" class="p-2.5 text-[15px] font-bold text-primary">
      {{ t("parcours.day.back") }}
    </RouterLink>
    <button type="button" class="p-2.5 text-[15px] font-bold text-text-secondary" @click="undo">
      {{ t("parcours.reader.undo") }}
    </button>
  </PullToMark>
</template>
