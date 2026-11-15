<script setup lang="ts">
/**
 * The check of an aliyah of chnei mikra (DailyReadingItem, on the chnei
 * mikra page): a pill track with a knob, swiped right once the aliyah is
 * read, as a card of the home stack or of the Sidour is swiped right to say
 * it is done. Read, the knob stays on the right with its check; swiped back
 * to the left, the aliyah is unread again.
 *
 * It sits twice around the aliyah: in place of its title above the text
 * (whoever read it elsewhere checks it without scrolling down), and where it
 * ends (whoever has just read it). Both show the same state.
 *
 * The swipe is the gesture; a tap does the same (a mouse, a screen reader,
 * Enter or Space), so the check is never out of reach.
 *
 * It is drawn in flat colors and on one line (the aliyah's name, then « Lue »
 * once read): a track in the tone of the other flat controls, a disc of the
 * brand color, no border and no shadow (docs/design.md).
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useSwipe } from "../composables/useSwipe";
import { haptic } from "../services/haptics";
import AppIcon from "./icons/AppIcon.vue";

const props = defineProps<{
  done: boolean;
  /** The aliyah's title (« Rishon », « Chlichi »...). */
  name: string;
}>();

const emit = defineEmits<{ (e: "toggle", done: boolean): void }>();

const { t } = useI18n();

/** As the swiped cards and lines (SidourLine, ProgramDaily). */
const SWIPE_THRESHOLD = 110;
const KNOB = 36;
const INSET = 4;

const track = ref<HTMLElement | null>(null);
/** How far the knob can travel, measured when a gesture starts. */
const travel = ref(0);

function toggle(): void {
  const next = !props.done;
  haptic(next ? "done" : "undo");
  emit("toggle", next);
}

const swipe = useSwipe({
  x: true,
  threshold: SWIPE_THRESHOLD,
  onSwipe(direction) {
    if ((direction === "right") !== props.done) toggle();
  },
});

watch(swipe.dragging, (dragging) => {
  if (dragging) travel.value = Math.max(0, (track.value?.offsetWidth ?? 0) - KNOB - 2 * INSET);
});

/** The knob's offset from where it rests, following the finger in its lane. */
const offset = computed(() => {
  if (!swipe.dragging.value || swipe.axis.value !== "x") return 0;
  const dx = swipe.dx.value;
  return props.done
    ? Math.min(0, Math.max(-travel.value, dx))
    : Math.max(0, Math.min(travel.value, dx));
});
/** Let go now, the gesture acts. */
const armed = computed(
  () => offset.value !== 0 && Math.abs(offset.value) >= Math.min(SWIPE_THRESHOLD, travel.value),
);
watch(armed, (now) => {
  if (now) haptic("tick");
});

/** How far toward the other end: the words fade as the knob covers them. */
const share = computed(() => (travel.value > 0 ? Math.abs(offset.value) / travel.value : 0));

/** Read, or about to be: the knob carries the check. */
const checked = computed(() => (props.done ? !armed.value : armed.value));
</script>

<template>
  <button
    ref="track"
    type="button"
    role="checkbox"
    class="aliya-check"
    :class="{ 'is-done': done, 'is-armed': armed, 'is-dragging': swipe.dragging.value }"
    :style="{ '--offset': `${offset}px`, '--share': share }"
    :aria-checked="done"
    :aria-label="t('chneiMikra.aliyaCheck', { aliya: name })"
    v-bind="swipe.listeners"
    @click="toggle"
  >
    <span class="aliya-check-fill" aria-hidden="true" />
    <span class="aliya-check-text" aria-hidden="true">
      {{ name }}
      <span v-if="done" class="aliya-check-done">· {{ t("chneiMikra.aliyaDone") }}</span>
    </span>
    <span class="aliya-check-knob" :class="{ 'is-checked': checked }" aria-hidden="true">
      <svg v-if="checked" viewBox="0 0 24 24" class="aliya-check-icon">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
      <AppIcon v-else name="chevron-right" :size="18" />
    </span>
  </button>
</template>

<style scoped>
/* A round control (docs/design.md): the track is a pill, the knob a disc,
   both in flat colors, with no border and no shadow. The track takes the
   tone of the other flat controls (the text size A- / A+), the knob the
   brand color. The swipe goes to the right in every language, as everywhere
   in the app, so the knob is placed with physical sides. */
.aliya-check {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 18rem;
  height: 44px;
  margin-inline: auto;
  padding: 0 48px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.aliya-check:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* The band the knob leaves behind it: one flat tint, no gradient. */
.aliya-check-fill {
  position: absolute;
  inset-block: 0;
  left: 0;
  width: calc(36px + 8px + var(--offset));
  background: color-mix(in srgb, var(--color-brand) 22%, transparent);
  transition: width 0.25s ease;
}
.aliya-check.is-done .aliya-check-fill {
  width: calc(100% + var(--offset));
}
.aliya-check.is-dragging .aliya-check-fill {
  transition: none;
}

.aliya-check-text {
  position: relative;
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--color-text-primary);
  opacity: calc(1 - var(--share) * 0.7);
}
.aliya-check-done {
  color: var(--color-primary);
}

.aliya-check-knob {
  position: absolute;
  top: 50%;
  left: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-pill);
  background: var(--color-brand);
  color: var(--color-on-brand);
  transform: translate(var(--offset), -50%);
  transition:
    left 0.25s ease,
    transform 0.25s ease;
}
.aliya-check.is-done .aliya-check-knob {
  left: calc(100% - 36px - 4px);
}
.aliya-check.is-dragging .aliya-check-knob {
  transition: none;
}
.aliya-check-icon {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (prefers-reduced-motion: reduce) {
  .aliya-check-fill,
  .aliya-check-knob {
    transition: none;
  }
}
</style>
