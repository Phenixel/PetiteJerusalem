<script setup lang="ts">
/**
 * La carte d'une tâche : ce qu'on vient chercher prend la couleur, pleine
 * (docs/design.md), aux mesures de la carte du moment du Sidour. Elle porte
 * son objet quand elle en a un : le sidour d'un office, le volume d'un
 * programme.
 *
 * Toucher la carte ouvre sa page, directement (le texte, l'office). Une
 * tâche sans page (la tsédaka, garder sa langue) ouvre sa fiche à la place.
 * Les gestes (glisser, tirer, appuyer longtemps) sont posés par le parent :
 * la pile de l'accueil, la page d'un programme.
 *
 * Trois tenues : `color` (la carte du moment), `plain` (sur fond clair, une
 * carte de la journée), `done` (faite : grisée, son objet éteint).
 */
import { computed } from "vue";
import type { TaskView } from "../../composables/useParcoursViews";
import CardArt from "../CardArt.vue";

const props = withDefaults(
  defineProps<{ view: TaskView; tone?: "color" | "plain" | "done"; compact?: boolean }>(),
  { tone: "color", compact: false },
);
const emit = defineEmits<{ (e: "activate"): void }>();

const surface = computed(() => (props.tone === "color" ? "color" : "plain"));
</script>

<template>
  <component
    :is="view.route ? 'RouterLink' : 'button'"
    :to="view.route ?? undefined"
    :type="view.route ? undefined : 'button'"
    class="task-card relative block w-full rounded-card text-start"
    :class="[`task-card-${tone}`, compact ? 'px-4 pb-3.5 pt-3' : 'px-5 pb-5 pt-4']"
    @click="emit('activate')"
  >
    <CardArt
      v-if="view.art"
      :art="view.art"
      :scale="compact ? 0.5 : 1"
      :surface="surface"
      class="task-card-art"
    />
    <span class="task-kicker relative block text-sm font-semibold">{{ view.kicker }}</span>
    <span
      class="relative mt-1 block font-display font-bold leading-tight"
      :class="[compact ? 'text-xl' : 'text-3xl', view.art ? 'pe-[34%]' : '']"
    >
      {{ view.title }}
    </span>
    <span
      v-if="view.meta"
      class="task-meta relative mt-1 block text-[15px] font-medium"
      :class="view.art ? 'pe-[30%]' : ''"
    >
      {{ view.meta }}
    </span>
    <slot />
  </component>
</template>

<style scoped>
.task-card-color {
  background: var(--color-brand);
  color: var(--color-on-brand);
  box-shadow: var(--shadow-card-hover);
}
.task-card-color .task-kicker {
  color: color-mix(in srgb, var(--color-on-brand) 80%, transparent);
}
.task-card-color .task-meta {
  color: color-mix(in srgb, var(--color-on-brand) 90%, transparent);
}
.task-card-plain {
  background: var(--color-surface);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-card);
}
.task-card-plain .task-kicker,
.task-card-done .task-kicker {
  color: var(--color-primary);
}
.task-card-plain .task-meta,
.task-card-done .task-meta {
  color: var(--color-text-secondary);
}
/* Faite : grisée, à plat, son objet éteint ; on la retrouve sans qu'elle appelle. */
.task-card-done {
  background: var(--color-surface-soft);
  color: var(--color-text-secondary);
}
.task-card-done .task-kicker {
  color: var(--color-text-secondary);
}
.task-card-done :deep(.task-card-art) {
  filter: grayscale(1);
  opacity: 0.45;
}
</style>
