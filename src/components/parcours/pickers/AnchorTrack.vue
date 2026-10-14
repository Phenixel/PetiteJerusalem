<script setup lang="ts">
/**
 * Le fil du jour et son rond (P2-Habitude) : on pose le moment d'une
 * habitude, ou d'un programme, en glissant le rond jusqu'à un repère (au
 * réveil, avec Cha'harit, à midi, avec Min'ha, avec Arvit, au coucher). Le
 * rond se pose sur le repère le plus proche ; passer d'un repère à l'autre
 * se sent au doigt. Au clavier, les flèches le déplacent.
 *
 * `null` : toute la journée (le parent offre ce choix à côté).
 */
import { computed, ref } from "vue";
import { HABIT_ANCHORS, type HabitAnchor } from "../../../services/parcours/model";
import { useI18n } from "vue-i18n";
import { haptic } from "../../../services/haptics";

defineProps<{ label: string; valueText: string }>();
const anchor = defineModel<HabitAnchor | null>("anchor", { required: true });

const { t } = useI18n();

/** Où sont les repères sur le fil, en pour cent de sa largeur. */
const POSITIONS: Record<HabitAnchor, number> = {
  wake: 6,
  chaharit: 18,
  noon: 40,
  minha: 66,
  arvit: 80,
  bedtime: 94,
};

const track = ref<HTMLElement | null>(null);
const dragging = ref<number | null>(null);

function nearest(position: number): HabitAnchor {
  return HABIT_ANCHORS.reduce((best, a) =>
    Math.abs(POSITIONS[a] - position) < Math.abs(POSITIONS[best] - position) ? a : best,
  );
}

function positionOf(event: PointerEvent): number {
  const rect = track.value?.getBoundingClientRect();
  if (!rect || rect.width === 0) return 50;
  const share = ((event.clientX - rect.left) / rect.width) * 100;
  // Le fil se lit dans le sens de la page : en hébreu, le réveil est à droite.
  const dirShare = getComputedStyle(track.value!).direction === "rtl" ? 100 - share : share;
  return Math.max(2, Math.min(98, dirShare));
}

function onDown(event: PointerEvent): void {
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  } catch {
    // Le pointeur est déjà relâché : rien à capturer.
  }
  dragging.value = positionOf(event);
}
function onMove(event: PointerEvent): void {
  if (dragging.value === null) return;
  const before = nearest(dragging.value);
  dragging.value = positionOf(event);
  // Le rond passe d'un repère à l'autre : un battement.
  if (nearest(dragging.value) !== before) haptic("tick");
}
function onUp(): void {
  if (dragging.value === null) return;
  anchor.value = nearest(dragging.value);
  dragging.value = null;
}

function onKey(event: KeyboardEvent): void {
  const index = anchor.value ? HABIT_ANCHORS.indexOf(anchor.value) : -1;
  const forward = event.key === "ArrowRight" || event.key === "ArrowUp";
  const backward = event.key === "ArrowLeft" || event.key === "ArrowDown";
  if (!forward && !backward) return;
  event.preventDefault();
  const rtl = getComputedStyle(event.currentTarget as HTMLElement).direction === "rtl";
  const step =
    (forward ? 1 : -1) *
    (rtl && (event.key === "ArrowRight" || event.key === "ArrowLeft") ? -1 : 1);
  const next = Math.max(0, Math.min(HABIT_ANCHORS.length - 1, (index < 0 ? 0 : index) + step));
  anchor.value = HABIT_ANCHORS[next];
}

const knot = computed(() => {
  if (dragging.value !== null) return dragging.value;
  return anchor.value ? POSITIONS[anchor.value] : null;
});
</script>

<template>
  <div
    ref="track"
    class="anchor-track"
    role="slider"
    tabindex="0"
    :aria-label="label"
    :aria-valuetext="valueText"
    aria-valuemin="0"
    :aria-valuemax="HABIT_ANCHORS.length - 1"
    :aria-valuenow="anchor ? HABIT_ANCHORS.indexOf(anchor) : undefined"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @keydown="onKey"
  >
    <span class="anchor-line" />
    <template v-for="(a, i) in HABIT_ANCHORS" :key="a">
      <span class="anchor-point" :style="{ insetInlineStart: `${POSITIONS[a]}%` }" />
      <span
        class="anchor-label"
        :style="{ insetInlineStart: `${POSITIONS[a]}%`, top: i % 2 === 0 ? '70px' : '8px' }"
      >
        {{ t(`parcours.anchorPoints.${a}`) }}
      </span>
    </template>
    <span v-if="knot !== null" class="anchor-knot" :style="{ insetInlineStart: `${knot}%` }" />
  </div>
</template>

<style scoped>
.anchor-track {
  position: relative;
  height: 96px;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: pointer;
}
.anchor-track:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-card);
}
.anchor-line {
  position: absolute;
  inset-inline: 0;
  top: 46px;
  height: 3px;
  border-radius: 3px;
  background: var(--color-line-strong);
}
.anchor-point {
  position: absolute;
  top: 42px;
  width: 11px;
  height: 11px;
  margin-inline-start: -5.5px;
  border-radius: var(--radius-pill);
  background: var(--color-page);
  box-shadow: inset 0 0 0 2px var(--color-line-strong);
}
.anchor-label {
  position: absolute;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
}
[dir="rtl"] .anchor-label {
  transform: translateX(50%);
}
.anchor-knot {
  position: absolute;
  top: 33px;
  width: 30px;
  height: 30px;
  margin-inline-start: -15px;
  border-radius: var(--radius-pill);
  background: var(--color-brand);
  box-shadow:
    0 0 0 6px color-mix(in srgb, var(--color-brand) 25%, transparent),
    0 3px 8px rgb(58 46 30 / 0.25);
}
</style>
