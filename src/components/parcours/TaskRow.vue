<script setup lang="ts">
/**
 * Une tâche en ligne (Ma journée, la feuille d'un jour du mur) : son nom, ce
 * qu'elle demande, et la case qui la coche.
 *
 * Toucher la ligne ouvre sa page (le texte, l'office), sans second toucher ;
 * la case, elle, coche sans rien ouvrir. Dans l'app, la ligne se glisse
 * aussi : à droite, c'est fait (ou défait) ; à gauche, « Pas aujourd'hui ».
 * Chaque geste a donc son bouton, pour qui ne glisse pas, et sur le site.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useSwipe } from "../../composables/useSwipe";
import type { TaskView } from "../../composables/useParcoursViews";
import TaskCheck from "./TaskCheck.vue";

const props = withDefaults(defineProps<{ view: TaskView; swipe?: boolean }>(), { swipe: false });

const emit = defineEmits<{
  (e: "toggle", done: boolean): void;
  (e: "skip", skipped: boolean): void;
  (e: "open"): void;
}>();

const { t } = useI18n();

const done = computed(() => props.view.progress === "done");

const gesture = useSwipe({
  x: true,
  onSwipe(direction) {
    if (direction === "right") emit("toggle", !done.value);
    else if (direction === "left") emit("skip", !props.view.skipped);
  },
});

const slide = computed(() =>
  gesture.dragging.value
    ? { transform: `translateX(${gesture.dx.value}px)`, transition: "none" }
    : {},
);
const reveal = computed(() =>
  gesture.dx.value > 0 ? "done" : gesture.dx.value < 0 ? "skip" : null,
);
</script>

<template>
  <div class="task-row" :class="{ 'is-done': done, 'is-skipped': view.skipped }">
    <!-- Ce que le geste découvre : la couleur du thème, et ce qu'il va faire. -->
    <div
      v-if="swipe && reveal"
      class="task-reveal"
      :class="`task-reveal-${reveal}`"
      aria-hidden="true"
    >
      <span>{{
        reveal === "done"
          ? t(done ? "parcours.row.undo" : "parcours.row.done")
          : t("parcours.row.skip")
      }}</span>
    </div>
    <div class="task-slide" :style="slide" v-bind="swipe ? gesture.listeners : {}">
      <RouterLink
        v-if="view.route"
        :to="view.route"
        class="task-body press-feedback"
        @click="emit('open')"
      >
        <span class="task-title">{{ view.title }}</span>
        <span v-if="view.meta" class="task-meta">{{ view.meta }}</span>
      </RouterLink>
      <div v-else class="task-body">
        <span class="task-title">{{ view.title }}</span>
        <span v-if="view.meta" class="task-meta">{{ view.meta }}</span>
      </div>
      <TaskCheck :view="view" @toggle="(next) => emit('toggle', next)" />
    </div>
  </div>
</template>

<style scoped>
.task-row {
  position: relative;
  overflow: hidden;
}
.task-slide {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  min-height: 60px;
  background: var(--color-surface);
  transition: transform 0.25s ease;
  touch-action: pan-y;
}
.task-body {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
}
.task-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.task-meta {
  margin-top: 2px;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.is-done .task-title {
  color: var(--color-text-secondary);
}
.is-skipped .task-title,
.is-skipped .task-meta {
  opacity: 0.55;
}
.task-reveal {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  padding-inline: 18px;
  font-size: 14px;
  font-weight: 700;
}
.task-reveal-done {
  justify-content: flex-start;
  background: var(--color-brand);
  color: var(--color-on-brand);
}
.task-reveal-skip {
  justify-content: flex-end;
  background: var(--color-surface-soft);
  color: var(--color-text-secondary);
}
</style>
