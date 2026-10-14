<script setup lang="ts">
/**
 * La case qui coche une tâche, sans rien ouvrir : un rond, plein et coché
 * quand c'est fait, cerclé de la couleur du thème quand c'est commencé (une
 * portion lue en partie). Celle des lignes de Ma journée et des cartes du
 * portefeuille.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { TaskView } from "../../composables/useParcoursViews";
import AppIcon from "../icons/AppIcon.vue";

const props = defineProps<{ view: TaskView }>();
const emit = defineEmits<{ (e: "toggle", done: boolean): void }>();

const { t } = useI18n();
const done = computed(() => props.view.progress === "done");
</script>

<template>
  <button
    type="button"
    class="task-check"
    :class="{ 'is-on': done, 'is-half': view.progress === 'partial' }"
    :aria-pressed="done"
    :aria-label="t(done ? 'parcours.row.uncheck' : 'parcours.row.check', { name: view.title })"
    @click="emit('toggle', !done)"
  >
    <AppIcon v-if="done" name="check" :size="16" :stroke-width="3" />
  </button>
</template>

<style scoped>
.task-check {
  display: grid;
  flex: none;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 2px solid color-mix(in srgb, var(--color-text-primary) 22%, transparent);
  border-radius: var(--radius-pill);
  color: var(--color-on-brand);
}
.task-check.is-half {
  border-color: var(--color-brand);
}
.task-check.is-on {
  border-color: var(--color-brand);
  background: var(--color-brand);
}
</style>
