<script setup lang="ts">
/**
 * Un objectif en pause, dit en tête de sa page : depuis quand, que rien
 * n'est perdu, et « Reprendre » d'un toucher. La pause ne se lit plus
 * seulement dans les réglages ; sur l'étagère, son volume porte la même
 * pastille (VolumeShelf).
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useParcours } from "../../composables/useParcours";
import { useParcoursViews } from "../../composables/useParcoursViews";
import { analyticsService } from "../../services/analyticsService";
import type { Objective } from "../../services/parcours/model";
import AppIcon from "../icons/AppIcon.vue";

const props = defineProps<{ objective: Objective }>();

const { t } = useI18n();
const store = useParcours();
const views = useParcoursViews();

/** Depuis quand ; pour un programme, que sa fin reculera d'autant à la reprise. */
const message = computed(() => {
  const date = props.objective.pausedFrom ? views.dayLabel(props.objective.pausedFrom) : "";
  return props.objective.kind === "program"
    ? t("parcours.paused.sinceProgram", { date })
    : t("parcours.paused.since", { date });
});

function resume(): void {
  store.setPaused(props.objective.id, false);
  analyticsService.capture("parcours_objective_paused", {
    paused: false,
    kind: props.objective.kind,
  });
}
</script>

<template>
  <section v-if="objective.pausedFrom" class="paused-notice" role="status">
    <span class="paused-icon" aria-hidden="true">
      <AppIcon name="pause" class="size-5" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block text-[15px] font-bold">{{ t("parcours.paused.title") }}</span>
      <span class="mt-0.5 block text-[13px] leading-snug text-text-secondary">
        {{ message }}
      </span>
    </span>
    <button type="button" class="btn btn-primary resume-btn" @click="resume">
      <AppIcon name="play" class="size-4" />
      {{ t("parcours.paused.resume") }}
    </button>
  </section>
</template>

<style scoped>
.paused-notice {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 12px 12px 14px;
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
}
.paused-icon {
  display: grid;
  flex: none;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}
.resume-btn {
  flex: none;
  min-height: 40px;
  gap: 6px;
  padding: 0 14px;
  font-size: 14px;
}
</style>
