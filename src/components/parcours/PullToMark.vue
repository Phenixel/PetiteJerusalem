<script setup lang="ts">
/**
 * The end of a reading (P2-Lecteur): a small line, a ring and « Tirez vers le
 * haut », which takes no room from the text. Once the page can scroll no
 * further, pushing it up again, from anywhere on the page, fills the ring;
 * let go once it is full, it is done (endPull.ts). The page scrolls as
 * usual, the line included: the gesture only reads the touches, it holds
 * none of them back. With a mouse, the line is dragged upward; for whoever
 * does not pull, it is a button: Enter or Space do the same. Once done, the
 * full card says so, and the default slot holds what follows (undo, read
 * on).
 *
 * Shared by the day's portion (ReaderTaskCard) and the end of a service's
 * text (OfficeDoneCard): the same gesture wherever a reading ends.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { haptic } from "../../services/haptics";
import { END_PULL, NO_PULL, movePull, pullShare, type EndPull } from "./endPull";

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

const root = ref<HTMLElement | null>(null);
const pulling = ref(false);
const rise = ref(0);

const share = computed(() => (props.done ? 1 : pullShare(rise.value)));
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

function stop(): boolean {
  const reached = pulling.value && rise.value >= END_PULL;
  pulling.value = false;
  rise.value = 0;
  return reached;
}

/** The page can scroll no further down, and the line is in view. */
function atEnd(): boolean {
  const el = root.value;
  if (!el) return false;
  const height = document.documentElement.scrollHeight;
  if (window.scrollY + window.innerHeight < height - 4) return false;
  const rect = el.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0;
}

/** A sheet, a field or a selection being made keeps its touches. */
function ignored(target: EventTarget | null): boolean {
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed) return true;
  return (
    target instanceof Element &&
    target.closest('[role="dialog"], input, textarea, select, [contenteditable="true"]') !== null
  );
}

// The finger, anywhere on the page. Passive listeners: the page scrolls as
// it always does; the pull only counts what comes after its end.
let touch: EndPull | null = null;

function onTouchStart(event: TouchEvent): void {
  touch = null;
  if (props.done || event.touches.length !== 1 || ignored(event.target)) return;
  const finger = event.touches[0]!;
  touch = movePull(NO_PULL, finger.clientX, finger.clientY, atEnd());
}
function onTouchMove(event: TouchEvent): void {
  if (!touch) return;
  if (event.touches.length !== 1) {
    // A second finger: a pinch, not a pull.
    touch = null;
    stop();
    return;
  }
  const finger = event.touches[0]!;
  touch = movePull(touch, finger.clientX, finger.clientY, atEnd());
  pulling.value = touch.rise > 0;
  rise.value = touch.rise;
}
function onTouchEnd(): void {
  if (!touch) return;
  touch = null;
  if (stop()) mark();
}

onMounted(() => {
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("touchcancel", onTouchEnd, { passive: true });
});
onBeforeUnmount(() => {
  window.removeEventListener("touchstart", onTouchStart);
  window.removeEventListener("touchmove", onTouchMove);
  window.removeEventListener("touchend", onTouchEnd);
  window.removeEventListener("touchcancel", onTouchEnd);
});

// The mouse has no page to push past its end: it drags the line itself.
let y0: number | null = null;

function onDown(event: PointerEvent): void {
  if (props.done || event.pointerType !== "mouse" || event.button !== 0) return;
  y0 = event.clientY;
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  } catch {
    // The pointer is already released: nothing to capture.
  }
  pulling.value = true;
  rise.value = 0;
}
function onMove(event: PointerEvent): void {
  if (y0 !== null) rise.value = Math.max(0, y0 - event.clientY);
}
function onUp(): void {
  if (y0 === null) return;
  y0 = null;
  if (stop()) mark();
}
</script>

<template>
  <section
    ref="root"
    class="reader-end"
    :class="done ? 'is-done' : 'is-hint'"
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
    <div :class="done ? 'mt-4 flex flex-col items-center' : 'mt-2.5 flex items-center gap-3'">
      <svg
        class="shrink-0"
        :width="done ? 76 : 36"
        :height="done ? 76 : 36"
        viewBox="0 0 76 76"
        aria-hidden="true"
      >
        <circle cx="38" cy="38" r="32" class="ring" :class="{ 'is-thick': !done }" />
        <circle
          cx="38"
          cy="38"
          r="32"
          class="ring-fill"
          :class="{ 'is-thick': !done }"
          pathLength="100"
          :stroke-dasharray="`${Math.round(share * 100)} 100`"
          transform="rotate(-90 38 38)"
        />
        <circle cx="38" cy="38" :r="coreRadius" class="core" />
        <path v-if="done" d="M27 38.5l7.5 7.5L50 30.5" class="check" />
      </svg>
      <div :class="done ? 'mt-3.5 text-center' : 'text-start'">
        <p :class="done ? 'text-[17px] font-extrabold' : 'text-[15px] font-bold'">
          {{ label[state] }}
        </p>
        <p :class="done ? 'mt-1 text-sm' : 'text-[13px]'" class="text-text-secondary">
          {{ sub[state] }}
        </p>
      </div>
    </div>
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
  border-top: 1px solid var(--color-line);
  user-select: none;
  -webkit-user-select: none;
}
.reader-end.is-hint {
  padding: 18px 18px 28px;
  cursor: grab;
}
.reader-end.is-done {
  padding: 26px 18px 60px;
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
/* Drawn at half size, the ring keeps a visible stroke. */
.ring.is-thick,
.ring-fill.is-thick {
  stroke-width: 7;
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
  .core {
    transition: none;
  }
}
</style>
