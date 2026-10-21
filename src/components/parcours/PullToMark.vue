<script setup lang="ts">
/**
 * The end of a reading (P2-Lecteur): a small line, a ring and « Tirez vers le
 * haut », which takes no room from the text. Once the page can scroll no
 * further, a finger laid anywhere on the page and pushing it up again fills
 * the ring; let go once it is full, it is done (endPull.ts). The finger
 * that scrolls the page to its end never marks it, even if it keeps going:
 * the pull is a gesture of its own. The page scrolls as usual, the line
 * included: the gesture only reads the touches, it holds none of them back.
 * With a mouse, the line is dragged upward; for whoever does not pull, it is
 * a button: Enter or Space do the same.
 *
 * The line grows into the card as it is pulled, one shape and never two
 * that swap: the ring swells and slides to the middle, the line fades out
 * beside it, the heading and the two lines come in, and full, it is the card
 * shown once done, which then takes its place without a jump. While it
 * grows, it rises over the end of the text, its bottom fixed: the page keeps
 * its height, so it stays at its end under the finger. Once done, the
 * default slot holds what follows (undo, read on).
 *
 * Shared by the day's portion (ReaderTaskCard) and the end of a service's
 * text (OfficeDoneCard): the same gesture wherever a reading ends.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { haptic } from "../../services/haptics";
import {
  END_PULL,
  FULL_HEIGHT,
  REST,
  endPullLayout,
  movePull,
  pullGrowth,
  pullShare,
  startPull,
  type EndPull,
} from "./endPull";

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
const line = ref<HTMLElement | null>(null);
const lineWidth = ref(0);
const pulling = ref(false);
const rise = ref(0);
/** Let go full: the card holds its size until the reading is marked. */
const held = ref(false);

const share = computed(() => (props.done || held.value ? 1 : pullShare(rise.value)));
const coreRadius = computed(() => (props.done ? 26 : Math.round(6 + share.value * 16)));
const state = computed(() => (props.done ? "done" : share.value >= 1 ? "release" : "pull"));
const layout = computed(() => endPullLayout(pullGrowth(share.value), lineWidth.value));
/** Drawn small, the ring keeps a stroke that can be seen. */
const stroke = computed(() => 4 * Math.sqrt(76 / layout.value.ring));

/** Logical offsets from the middle: the line's start is on the right in Hebrew. */
const fromMiddle = (px: number): string => `calc(50% + ${px.toFixed(1)}px)`;

function measure(): void {
  lineWidth.value = line.value?.offsetWidth ?? 0;
}
watch(
  () => [props.label.pull, props.sub.pull, props.done],
  () => nextTick(measure),
);

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

let release: ReturnType<typeof setTimeout> | undefined;

function stop(): boolean {
  const reached = pulling.value && rise.value >= END_PULL;
  pulling.value = false;
  rise.value = 0;
  if (reached) {
    held.value = true;
    // Not marked after all (nothing to mark any more): the line comes back.
    release = setTimeout(() => (held.value = false), 1500);
  }
  return reached;
}

// Marked from the pull: the card replaces the zone that grew over the text.
// The card lays out below where the zone stood, taller than the line by as
// much: the page moves by as much, and the card stays where it was seen.
watch(
  () => props.done,
  async (done) => {
    if (!done || !held.value) return;
    clearTimeout(release);
    held.value = false;
    await nextTick();
    window.scrollBy({ top: FULL_HEIGHT - REST.height, behavior: "instant" });
  },
);

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
// it always does; only a finger laid at its end pulls.
let touch: EndPull | null = null;

function onTouchStart(event: TouchEvent): void {
  touch = null;
  if (props.done || held.value || event.touches.length !== 1 || ignored(event.target)) return;
  const finger = event.touches[0]!;
  const laid = startPull(finger.clientX, finger.clientY, atEnd());
  // Laid before the end, the finger scrolls: it will not pull, even there.
  if (laid.anchorY !== null) touch = laid;
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
  measure();
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("touchcancel", onTouchEnd, { passive: true });
});
onBeforeUnmount(() => {
  clearTimeout(release);
  window.removeEventListener("touchstart", onTouchStart);
  window.removeEventListener("touchmove", onTouchMove);
  window.removeEventListener("touchend", onTouchEnd);
  window.removeEventListener("touchcancel", onTouchEnd);
});

// The mouse has no page to push past its end: it drags the line itself.
let y0: number | null = null;

function onDown(event: PointerEvent): void {
  if (props.done || held.value || event.pointerType !== "mouse" || event.button !== 0) return;
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
    :class="done ? 'is-done' : 'is-growing'"
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
    <!-- Done: the card, in the page. Same measures as the grown zone. -->
    <template v-if="done">
      <p class="text-[13px] leading-[18px] font-bold text-text-secondary">{{ heading }}</p>
      <svg class="mt-3.5" width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
        <circle cx="38" cy="38" r="32" class="ring" />
        <circle cx="38" cy="38" r="32" class="ring-fill" />
        <circle cx="38" cy="38" :r="coreRadius" class="core" />
        <path d="M27 38.5l7.5 7.5L50 30.5" class="check" />
      </svg>
      <p class="mt-3.5 text-center text-[17px] leading-6 font-extrabold">{{ label.done }}</p>
      <p class="mt-0.5 text-center text-sm text-text-secondary">{{ sub.done }}</p>
      <div class="mt-[18px] flex flex-wrap justify-center gap-2.5" @pointerdown.stop>
        <slot />
      </div>
    </template>

    <!-- Not yet: the zone that grows from the line, over the end of the text. -->
    <div
      v-else
      class="zone"
      :class="{ 'is-pulling': pulling }"
      :style="{ height: `${layout.height}px` }"
      aria-hidden="true"
    >
      <p
        class="part inset-x-0 text-center text-[13px] leading-[18px] font-bold text-text-secondary"
        :style="{ top: `${layout.headingY}px`, opacity: layout.cardOpacity }"
      >
        {{ heading }}
      </p>
      <svg
        class="part"
        :style="{
          insetInlineStart: fromMiddle(layout.ringX - layout.ring / 2),
          top: `${layout.ringY - layout.ring / 2}px`,
          width: `${layout.ring}px`,
          height: `${layout.ring}px`,
        }"
        viewBox="0 0 76 76"
      >
        <circle cx="38" cy="38" r="32" class="ring" :style="{ strokeWidth: stroke }" />
        <circle
          cx="38"
          cy="38"
          r="32"
          class="ring-fill"
          :style="{ strokeWidth: stroke }"
          pathLength="100"
          :stroke-dasharray="`${Math.round(share * 100)} 100`"
          transform="rotate(-90 38 38)"
        />
        <circle cx="38" cy="38" :r="coreRadius" class="core" />
      </svg>
      <p
        ref="line"
        class="part whitespace-nowrap text-[13px] leading-[18px]"
        :style="{
          insetInlineStart: fromMiddle(layout.lineX),
          top: `${layout.ringY - 9}px`,
          opacity: layout.lineOpacity,
        }"
      >
        <span class="font-bold">{{ label.pull }}</span>
        <span class="ms-1 text-text-secondary">{{ sub.pull }}</span>
      </p>
      <div
        class="part inset-x-0 text-center"
        :style="{ top: `${layout.textY}px`, opacity: layout.cardOpacity }"
      >
        <p class="text-[17px] leading-6 font-extrabold">{{ label[state] }}</p>
        <p class="mt-0.5 text-sm text-text-secondary">{{ sub[state] }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.reader-end {
  user-select: none;
  -webkit-user-select: none;
}
.reader-end.is-done {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 18px 60px;
  border-top: 1px solid var(--color-line);
}
/* In the page, only the line: the zone grows above it, its bottom fixed,
   over the end of the text, which the page's color covers. */
.reader-end.is-growing {
  position: relative;
  height: 44px;
  cursor: grab;
}
.zone {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  overflow: hidden;
  background: var(--color-page);
  border-top: 1px solid var(--color-line);
}
.part {
  position: absolute;
  margin: 0;
}
/* Let go short, it shrinks back; under the finger, it follows it. */
.zone,
.part {
  transition:
    height 0.3s ease,
    top 0.3s ease,
    inset-inline-start 0.3s ease,
    width 0.3s ease,
    opacity 0.3s ease;
}
.zone.is-pulling,
.zone.is-pulling .part {
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
  .zone,
  .part,
  .core {
    transition: none;
  }
}
</style>
