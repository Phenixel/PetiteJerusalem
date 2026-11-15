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
 * It is drawn on one line (the aliyah's name, then « Lue » once read), with
 * no border and no shadow (docs/design.md). Unread, it holds no orange at
 * all: a white track, a soft gray disc. The brand color comes with the
 * gesture: the disc takes it as soon as it moves, a solid band follows it,
 * and once read the band sweeps across the whole track, the disc turns
 * white and its check draws itself.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue";
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

/**
 * Just toggled by a touch on this very check: the disc bounces and its check
 * draws itself. Not on a check that opens already read, nor on its twin at
 * the other end of the aliyah, which only follows.
 */
const fresh = ref(false);
let freshTimer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => clearTimeout(freshTimer));

function toggle(): void {
  const next = !props.done;
  haptic(next ? "done" : "undo");
  fresh.value = next;
  clearTimeout(freshTimer);
  freshTimer = setTimeout(() => (fresh.value = false), 1200);
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
    :class="{
      'is-done': done,
      'is-armed': armed,
      'is-moving': offset !== 0,
      'is-dragging': swipe.dragging.value,
      'is-fresh': fresh,
    }"
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
        <path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1" />
      </svg>
      <AppIcon v-else name="chevron-right" :size="18" />
    </span>
  </button>
</template>

<style scoped>
/* A round control (docs/design.md): the track is a pill, the knob a disc,
   with no border and no shadow. Unread, no orange: a white track (the
   surface of a card) and a soft gray disc. The swipe goes to the right in
   every language, as everywhere in the app, so the knob is placed with
   physical sides. */
.aliya-check {
  /* The curve of the sweep: a quick start, a long soft landing. */
  --sweep: cubic-bezier(0.22, 1, 0.36, 1);
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
  background: var(--color-surface);
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.aliya-check:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* The band of the brand color: hidden at rest, it follows the knob as soon
   as it moves, then sweeps across the whole track once the aliyah is read.
   One flat color, no gradient. */
.aliya-check-fill {
  position: absolute;
  inset-block: 0;
  left: 0;
  width: calc(44px + var(--offset));
  border-radius: var(--radius-pill);
  background: var(--color-brand);
  opacity: 0;
  transition:
    width 0.6s var(--sweep),
    opacity 0.25s ease;
}
.aliya-check.is-moving .aliya-check-fill,
.aliya-check.is-done .aliya-check-fill {
  opacity: 1;
}
.aliya-check.is-done .aliya-check-fill {
  width: calc(100% + var(--offset));
}
/* Unread again: the band withdraws, then fades once back under the knob. */
.aliya-check:not(.is-done):not(.is-moving) .aliya-check-fill {
  transition:
    width 0.5s var(--sweep),
    opacity 0.2s ease 0.35s;
}
.aliya-check.is-dragging .aliya-check-fill {
  transition: opacity 0.15s ease;
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
  transition: color 0.3s ease 0.15s;
}
.aliya-check.is-done .aliya-check-text {
  color: var(--color-on-brand);
}
.aliya-check-done {
  opacity: 0.85;
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
  background: color-mix(in srgb, var(--color-text-primary) 7%, transparent);
  color: var(--color-text-secondary);
  transform: translate(var(--offset), -50%);
  transition:
    left 0.6s var(--sweep),
    transform 0.6s var(--sweep),
    background-color 0.2s ease,
    color 0.2s ease;
}
/* Under the finger, the knob takes the brand color. */
.aliya-check.is-moving .aliya-check-knob {
  background: var(--color-brand);
  color: var(--color-on-brand);
}
/* Read: on the right, white on the band, its check in the theme color. */
.aliya-check.is-done .aliya-check-knob {
  left: calc(100% - 36px - 4px);
  background: var(--color-surface);
  color: var(--color-primary);
}
.aliya-check.is-dragging .aliya-check-knob {
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}
/* Just read: the disc lands with a small bounce once the band is across.
   `scale`, not `transform`: the bounce adds to the slide instead of
   replacing it. */
.aliya-check.is-fresh.is-done .aliya-check-knob {
  animation: aliya-knob-land 0.45s var(--sweep) 0.35s;
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
/* ...and its check draws itself, stroke by stroke. */
.aliya-check.is-fresh .aliya-check-icon path {
  stroke-dasharray: 1;
  animation: aliya-check-draw 0.4s ease-out 0.45s both;
}

@keyframes aliya-knob-land {
  40% {
    scale: 1.15;
  }
}
@keyframes aliya-check-draw {
  from {
    stroke-dashoffset: 1;
  }
  to {
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .aliya-check-fill,
  .aliya-check-knob,
  .aliya-check-text {
    transition: none !important;
  }
  .aliya-check-knob,
  .aliya-check-icon path {
    animation: none !important;
  }
}
</style>
