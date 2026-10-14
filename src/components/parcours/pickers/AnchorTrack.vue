<script setup lang="ts">
/**
 * Le fil du jour et son rond (P2-Habitude) : on pose le moment d'une
 * habitude, ou d'un programme, en glissant le rond jusqu'à un repère (au
 * réveil, avec Cha'harit, à midi, avec Min'ha, avec Arvit, au coucher). Le
 * rond se pose sur le repère le plus proche ; passer d'un repère à l'autre
 * se sent au doigt. Au clavier, les flèches le déplacent.
 *
 * Au-dessus du fil, l'interrupteur « Toute la journée » : allumé, le
 * repère est `null` et le fil s'éteint (on n'y choisit plus rien) ; éteint,
 * le rond revient sur le dernier repère choisi.
 */
import { computed, ref, watch } from "vue";
import { HABIT_ANCHORS, type HabitAnchor } from "../../../services/parcours/model";
import { useI18n } from "vue-i18n";
import { haptic } from "../../../services/haptics";
import ToggleSwitch from "../../ToggleSwitch.vue";

defineProps<{ label: string; valueText: string }>();
const anchor = defineModel<HabitAnchor | null>("anchor", { required: true });

const { t } = useI18n();

/** Le dernier repère posé : l'interrupteur éteint l'y ramène. */
let lastAnchor: HabitAnchor = anchor.value ?? "chaharit";
watch(anchor, (next) => {
  if (next) lastAnchor = next;
});

const allDay = computed({
  get: () => anchor.value === null,
  set: (on: boolean) => {
    anchor.value = on ? null : lastAnchor;
  },
});

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
  if (allDay.value) return;
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
  if (allDay.value) return;
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
  <div>
    <label class="all-day">
      <span>{{ t("parcours.create.allDay") }}</span>
      <ToggleSwitch v-model="allDay" />
    </label>
    <div
      ref="track"
      class="anchor-track"
      :class="{ 'is-off': allDay }"
      role="slider"
      :tabindex="allDay ? -1 : 0"
      :aria-disabled="allDay ? 'true' : undefined"
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
  </div>
</template>

<style scoped>
.all-day {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.anchor-track {
  position: relative;
  height: 96px;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: pointer;
}
/* Toute la journée : le fil s'éteint, on n'y choisit plus rien. */
.anchor-track.is-off {
  opacity: 0.35;
  pointer-events: none;
  cursor: default;
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
