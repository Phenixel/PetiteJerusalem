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
const KNOB = 48;
const INSET = 6;

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
      <span class="aliya-check-name">{{ name }}</span>
      <span class="aliya-check-sub">
        {{ done ? t("chneiMikra.aliyaDone") : t("chneiMikra.aliyaSwipe") }}
      </span>
    </span>
    <span class="aliya-check-knob" :class="{ 'is-checked': checked }" aria-hidden="true">
      <svg v-if="checked" viewBox="0 0 24 24" class="aliya-check-icon">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
      <AppIcon v-else name="chevron-right" :size="20" />
    </span>
  </button>
</template>

<style scoped>
/* A round control (docs/design.md): the track is a pill, the knob a disc.
   The swipe goes to the right in every language, as everywhere in the app,
   so the knob is placed with physical sides. */
.aliya-check {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 24rem;
  min-height: 60px;
  margin-inline: auto;
  padding: 8px 64px;
  overflow: hidden;
  border: 1.5px solid var(--color-line-strong);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}
.aliya-check:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.aliya-check.is-done {
  border-color: color-mix(in srgb, var(--color-primary) 45%, transparent);
}

/* The band the knob leaves behind it: one flat tint, no gradient. */
.aliya-check-fill {
  position: absolute;
  inset-block: 0;
  left: 0;
  width: calc(48px + 12px + var(--offset));
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
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
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  text-align: center;
  opacity: calc(1 - var(--share) * 0.7);
}
.aliya-check-name {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--color-text-primary);
}
.aliya-check-sub {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--color-text-secondary);
}
.aliya-check.is-done .aliya-check-sub {
  color: var(--color-primary);
}

.aliya-check-knob {
  position: absolute;
  top: 50%;
  left: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-primary);
  box-shadow: var(--shadow-card-hover);
  transform: translate(var(--offset), -50%);
  transition:
    left 0.25s ease,
    transform 0.25s ease,
    background-color 0.15s ease,
    color 0.15s ease;
}
.aliya-check.is-done .aliya-check-knob {
  left: calc(100% - 48px - 6px);
}
.aliya-check.is-dragging .aliya-check-knob {
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}
.aliya-check-knob.is-checked {
  border-color: var(--color-brand);
  background: var(--color-brand);
  color: var(--color-on-brand);
}
.aliya-check-icon {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (prefers-reduced-motion: reduce) {
  .aliya-check,
  .aliya-check-fill,
  .aliya-check-knob {
    transition: none;
  }
}
</style>
