<script setup lang="ts">
/**
 * En tête de la page d'un texte du jour ou d'une lecture du calendrier : ce
 * qu'il y a à lire aujourd'hui (« Psaumes 1 à 9 », « Berechit »), fait ou
 * non, et « Lire », qui l'ouvre là où on le lit. Sans elle, la page de ces
 * objectifs ne montrait que leurs réglages, et toucher leur volume ne menait
 * à aucun texte.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import { useParcoursViews } from "../../composables/useParcoursViews";
import type { CycleObjective, TextObjective } from "../../services/parcours/model";
import AppIcon from "../icons/AppIcon.vue";

const props = defineProps<{ objective: CycleObjective | TextObjective }>();

const { t } = useI18n();
const store = useParcours();
const views = useParcoursViews();

const task = computed(() =>
  store.todayTasks.value.find((one) => one.objectiveId === props.objective.id),
);
const view = computed(() => (task.value ? views.taskView(task.value, store.today.value) : null));
const done = computed(() => view.value?.progress === "done");
const target = computed(() => views.readRoute(props.objective, store.today.value));

/** Ce qu'on lit : les psaumes ou la paracha du jour ; le nom du texte, pour un texte. */
const reading = computed(() =>
  props.objective.kind === "cycle" && view.value
    ? view.value.meta
    : views.objectiveTitle(props.objective),
);
</script>

<template>
  <section v-if="target" class="card today-card">
    <span class="min-w-0 flex-1">
      <span class="block text-[13px] font-semibold text-text-secondary">
        {{ done ? t("parcours.objective.todayDone") : t("parcours.objective.today") }}
      </span>
      <span class="mt-0.5 block font-display text-xl font-bold leading-tight">{{ reading }}</span>
    </span>
    <RouterLink :to="target" class="btn btn-primary read-btn">
      <AppIcon name="book-open" class="size-4" />
      {{ done ? t("parcours.objective.readAgain") : t("parcours.objective.read") }}
    </RouterLink>
  </section>
</template>

<style scoped>
.today-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 14px 16px 18px;
}
.read-btn {
  flex: none;
  min-height: 44px;
  gap: 6px;
  padding: 0 18px;
}
</style>
