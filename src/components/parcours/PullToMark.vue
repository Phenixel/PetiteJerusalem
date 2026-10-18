<script setup lang="ts">
/**
 * The end of a reading (P2-Lecteur): a heading, and a ring pulled upward to
 * mark it done. The ring fills as it is pulled; let go at the end, it is
 * done. For whoever does not pull, the ring is a button: Enter or Space do
 * the same. Once done, the default slot holds what follows (undo, read on).
 *
 * Shared by the day's portion (ReaderTaskCard) and the end of a service's
 * text (OfficeDoneCard): the same gesture wherever a reading ends.
 */
import { computed, ref, watch } from "vue";
import { haptic } from "../../services/haptics";

const props = defineProps<{
  done: boolean;
  heading: string;
  /** The ring's name for a screen reader, until it is done. */
  aria: string;
  /** The line under the ring: while pulling, once full, once done. */
  label: { pull: string; release: string; done: string };
  sub: { pull: string; release: string; done: string };
}>();

const emit = defineEmits<{ (e: "mark"): void }>();

/** Pulled this far, it is done. */
const PULL = 120;

const pulling = ref(false);
const dy = ref(0);
let y0 = 0;

const share = computed(() => (props.done ? 1 : Math.max(0, Math.min(1, -dy.value / PULL))));
const coreRadius = computed(() => (props.done ? 26 : Math.round(6 + share.value * 16)));
const state = computed(() => (props.done ? "done" : share.value >= 1 ? "release" : "pull"));

function mark(): void {
  if (!props.done) emit("mark");
}

// The ring full: let go now, it is done. It can be felt.
watch(
  () => pulling.value && share.value >= 1,
  (full) => {
    if (full) haptic("tick");
  },
);

function onDown(event: PointerEvent): void {
  if (props.done || event.button !== 0) return;
  y0 = event.clientY;
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  } catch {
    // The pointer is already released: nothing to capture.
  }
  pulling.value = true;
  dy.value = 0;
}
function onMove(event: PointerEvent): void {
  if (pulling.value) dy.value = Math.min(0, event.clientY - y0);
}
function onUp(): void {
  if (!pulling.value) return;
  const reached = -dy.value >= PULL;
  pulling.value = false;
  dy.value = 0;
  if (reached) mark();
}
</script>

<template>
  <section
    class="reader-end"
    :class="{ 'is-pulling': pulling }"
    :style="pulling ? { transform: `translateY(${Math.max(-140, dy * 0.5)}px)` } : undefined"
    role="button"
    tabindex="0"
    :aria-label="done ? label.done : aria"
    :aria-pressed="done"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @keydown.enter.prevent="mark"
    @keydown.space.prevent="mark"
  >
    <p class="text-[13px] font-bold text-text-secondary">{{ heading }}</p>
    <svg class="mt-4" width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
      <circle cx="38" cy="38" r="32" class="ring" />
      <circle
        cx="38"
        cy="38"
        r="32"
        class="ring-fill"
        pathLength="100"
        :stroke-dasharray="`${Math.round(share * 100)} 100`"
        transform="rotate(-90 38 38)"
      />
      <circle cx="38" cy="38" :r="coreRadius" class="core" />
      <path v-if="done" d="M27 38.5l7.5 7.5L50 30.5" class="check" />
    </svg>
    <p class="mt-3.5 text-center text-[17px] font-extrabold">{{ label[state] }}</p>
    <p class="mt-1 text-center text-sm text-text-secondary">{{ sub[state] }}</p>
    <div v-if="done" class="mt-[18px] flex flex-wrap justify-center gap-2.5" @pointerdown.stop>
      <slot />
    </div>
  </section>
</template>

<style scoped>
.reader-end {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 26px 18px 60px;
  border-top: 1px solid var(--color-line);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: grab;
  transition: transform 0.3s ease;
}
.reader-end.is-pulling {
  transition: none;
}
.reader-end:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 4px;
}
.ring,
.ring-fill {
  fill: none;
  stroke-width: 4;
}
.ring {
  stroke: var(--color-line-strong);
}
.ring-fill {
  stroke: var(--color-primary);
  stroke-linecap: round;
}
.core {
  fill: var(--color-brand);
  transition: r 0.2s ease;
}
.check {
  fill: none;
  stroke: var(--color-on-brand);
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
@media (prefers-reduced-motion: reduce) {
  .reader-end,
  .core {
    transition: none;
  }
}
</style>
