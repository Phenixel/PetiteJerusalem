<script setup lang="ts">
/**
 * Une ligne du fil de Ma journée (P2-Journee) : son nœud sur le fil, son nom,
 * ce qu'elle demande, et de quoi l'ouvrir (« Sidour », « Lire »).
 *
 * Glissée à droite, elle est faite ; à gauche, elle passe à plus tard, ou
 * n'est plus faite si elle l'était. Ce que le geste fera se découvre sous
 * elle, en bande de couleur. Le nœud se touche aussi : il coche et décoche,
 * pour qui ne glisse pas.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { RouteLocationRaw } from "vue-router";
import { useSwipe } from "../../composables/useSwipe";

const props = defineProps<{
  title: string;
  sub: string;
  done: boolean;
  /** Où l'ouvrir, et le mot du lien ; rien, une ligne sans page. */
  route: RouteLocationRaw | null;
  action: string;
  /** Elle peut passer à plus tard (aujourd'hui seulement). */
  canLater: boolean;
}>();
const emit = defineEmits<{
  (e: "toggle", done: boolean): void;
  (e: "later"): void;
  (e: "opened"): void;
}>();

const { t } = useI18n();

/** Au-delà, la ligne lâchée agit. */
const THRESHOLD = 90;

const gesture = useSwipe({
  x: true,
  threshold: THRESHOLD,
  onSwipe(direction) {
    if (direction === "right" && !props.done) emit("toggle", true);
    else if (direction === "left" && props.done) emit("toggle", false);
    else if (direction === "left" && props.canLater) emit("later");
  },
});

/** La ligne ne part que du côté où elle a un geste. */
const leftAllowed = computed(() => props.done || props.canLater);
const dx = computed(() => {
  if (!gesture.dragging.value || gesture.axis.value !== "x") return 0;
  const value = gesture.dx.value;
  if (value > 0) return props.done ? 0 : value;
  return leftAllowed.value ? value : 0;
});
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const revealDone = computed(() => clamp(dx.value / THRESHOLD));
const revealLeft = computed(() => clamp(-dx.value / THRESHOLD));
</script>

<template>
  <div class="thread-wrap">
    <div class="thread-band thread-band-done" :style="{ opacity: revealDone }" aria-hidden="true">
      {{ t("parcours.hub.done") }}
    </div>
    <div class="thread-band thread-band-left" :style="{ opacity: revealLeft }" aria-hidden="true">
      {{ done ? t("parcours.hub.undo") : t("parcours.hub.later") }}
    </div>
    <div
      class="thread-item"
      :class="{ 'is-dragging': dx !== 0 }"
      :style="dx ? { transform: `translateX(${dx}px)`, transition: 'none' } : undefined"
      v-bind="gesture.listeners"
    >
      <button
        type="button"
        class="thread-knot"
        :class="{ 'is-done': done }"
        :aria-pressed="done"
        :aria-label="
          done
            ? t('parcours.row.uncheck', { name: title })
            : t('parcours.row.check', { name: title })
        "
        @pointerdown.stop
        @click="emit('toggle', !done)"
      />
      <div class="min-w-0 flex-1">
        <p class="text-base font-bold">{{ title }}</p>
        <p class="mt-0.5 text-[13px] text-text-secondary">{{ sub }}</p>
      </div>
      <RouterLink
        v-if="route && !done"
        :to="route"
        class="px-1 py-2.5 text-sm font-bold text-primary"
        @pointerdown.stop
        @click="emit('opened')"
      >
        {{ action }}
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.thread-wrap {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-card);
}
/* Ce que le geste fera, découvert sous la ligne qu'on pousse. */
.thread-band {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  padding: 0 18px;
  font-size: 14px;
  font-weight: 800;
}
.thread-band-done {
  background: var(--color-brand);
  color: var(--color-on-brand);
}
.thread-band-left {
  justify-content: flex-end;
  background: color-mix(in srgb, var(--color-text-primary) 10%, var(--color-page));
  color: var(--color-text-primary);
}
.thread-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding-block: 12px;
  padding-inline: 10px 8px;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  transition: transform 0.22s ease;
}
/* Glissée, la ligne prend le fond de la page : elle passe devant ce qu'elle découvre. */
.thread-item.is-dragging {
  background: var(--color-page);
}
/* Le nœud, sur le fil : vide, à faire ; plein, fait. */
.thread-knot {
  position: relative;
  z-index: 1;
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-pill);
  background: var(--color-page);
  box-shadow: inset 0 0 0 2px var(--color-line-strong);
}
.thread-knot.is-done {
  background: var(--color-brand);
  box-shadow: 0 0 0 4px var(--color-page);
}
@media (prefers-reduced-motion: reduce) {
  .thread-item {
    transition: none;
  }
}
</style>
