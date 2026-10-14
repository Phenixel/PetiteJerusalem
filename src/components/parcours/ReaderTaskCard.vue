<script setup lang="ts">
/**
 * Au bas d'une lecture ouverte depuis Mon parcours (`?objectif=`), la tâche
 * du jour qui y a mené : la portion d'un programme, un texte du jour. On la
 * marque faite là où l'on finit de lire, sans revenir à l'accueil. Elle suit
 * la lecture d'un chapitre à l'autre : l'adresse garde l'objectif.
 *
 * Chargée à la demande (voir TextReadingPage) : elle tire le calendrier
 * hébraïque.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import { useParcoursViews } from "../../composables/useParcoursViews";
import { useToast } from "../../composables/useToast";
import TaskCheck from "./TaskCheck.vue";

const props = defineProps<{ objectiveId: string }>();

const { t } = useI18n();
const store = useParcours();
const views = useParcoursViews();
const toast = useToast();

const view = computed(() => {
  const task = store.todayTasks.value.find(
    (candidate) => candidate.objectiveId === props.objectiveId,
  );
  return task ? views.taskView(task, store.today.value) : null;
});

function toggle(done: boolean): void {
  const current = view.value;
  if (!current) return;
  store.setDone(current.task, store.today.value, done, "reader");
  if (done) toast.success(t("parcours.reader.doneToast"));
}
</script>

<template>
  <section v-if="view" class="card flex items-center gap-4 px-5 py-4">
    <RouterLink :to="`/parcours/objectif/${view.objective.id}`" class="min-w-0 flex-1">
      <span class="block text-sm font-semibold text-primary">{{ t("parcours.title") }}</span>
      <span class="block font-bold">{{ view.title }}</span>
      <span v-if="view.meta" class="block text-sm text-text-secondary">{{ view.meta }}</span>
    </RouterLink>
    <TaskCheck :view="view" @toggle="toggle" />
  </section>
</template>
