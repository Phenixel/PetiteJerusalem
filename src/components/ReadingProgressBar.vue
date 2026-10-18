<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { isNativeApp } from "../composables/useNativeApp";
import { useScrollFrame } from "../composables/useScrollFrame";
import { useMiniPlayerVisible } from "../composables/useAudioPlayer";
import {
  readingScrubbing,
  readingSections,
  useSectionPosition,
} from "../composables/useReadingNav";
import {
  ARC_REACH,
  arcPlacement,
  bubblePlacement,
  scrubFraction,
} from "../composables/readingScrub";
import { haptic } from "../services/haptics";
import { analyticsService } from "../services/analyticsService";

/**
 * Reading progress: a thin line at the bottom of the screen that fills as one
 * goes down, the same on every text of the library. A service, a paracha, a
 * chapter of guemara are long and read in one go; the bar says where one
 * stands without asking for anything.
 *
 * It is also a slider: a finger (or the mouse) laid on it takes the page to
 * the same share of the text, and follows it while it slides. Whoever looks
 * for the Amida in a whole Shaharit, or the end of a long daf, gets there in
 * one gesture instead of three screens of scrolling. While it slides, the
 * titles of the text (the landmarks of the reading menu, when it has some)
 * line up above the bar on an arc: the one being read large, in the middle,
 * its neighbors smaller and lower on each side. The arc moves with the
 * finger: the next title grows as it comes nearer, until it is the one in
 * the middle, while the one it replaces shrinks away. The share reached
 * stays in the middle, above the titles; a text without titles shows it
 * alone, large. See docs/design.md, "The progress bar
 * takes you through the text".
 */
// The measure comes from the shared frame (useScrollFrame): a single listener
// and a single read of the document height for the whole app.
const scrollFrame = useScrollFrame();
const { locale } = useI18n();

// Native app: the bar sits above the bottom bar (h-14 + safe area), not
// against the edge of the screen where the gesture bar would cover it.
const bottomClass = isNativeApp ? "bottom-[calc(3.5rem+var(--safe-bottom))]" : "bottom-0";

const scrubbing = ref(false);
/** The share under the finger: the bar follows it, not the next frame. */
const scrubbed = ref(0);
const progress = computed(() => (scrubbing.value ? scrubbed.value : scrollFrame.value.progress));

const { items, position, current, remeasure } = useSectionPosition(() => readingSections.value);

/**
 * On the site, the mini player lies over the bottom of the screen: its
 * buttons keep their touches, and the bar goes back to being a thin line.
 * Nothing to slide either on a page that does not scroll.
 */
const isMiniPlayerVisible = useMiniPlayerVisible();
const interactive = computed(
  () =>
    !(isMiniPlayerVisible.value && !isNativeApp) &&
    scrollFrame.value.docHeight > scrollFrame.value.viewport,
);

const rtl = ref(false);
let pointerId: number | null = null;
let rect: DOMRect | null = null;
/** The width of the strip, the screen's: the bubble is held inside it. */
const stripWidth = ref(0);
let startProgress = 0;

function moveTo(clientX: number): void {
  if (!rect) return;
  scrubbed.value = scrubFraction(clientX, rect, rtl.value);
  const max = scrollFrame.value.docHeight - scrollFrame.value.viewport;
  window.scrollTo({ top: scrubbed.value * max, behavior: "instant" });
}

function onPointerDown(e: PointerEvent): void {
  if (!interactive.value || e.button !== 0) return;
  const strip = e.currentTarget as HTMLElement;
  // Text selection and the browser's own gestures stay out of the slide.
  e.preventDefault();
  strip.setPointerCapture?.(e.pointerId);
  pointerId = e.pointerId;
  rect = strip.getBoundingClientRect();
  stripWidth.value = rect.width;
  rtl.value = getComputedStyle(strip).direction === "rtl";
  startProgress = scrollFrame.value.progress;
  // The titles may have moved since the last measure (an image, a fold).
  remeasure();
  scrubbing.value = true;
  readingScrubbing.value = true;
  moveTo(e.clientX);
}

function onPointerMove(e: PointerEvent): void {
  if (e.pointerId !== pointerId) return;
  moveTo(e.clientX);
}

function endScrub(e?: PointerEvent): void {
  if (e && e.pointerId !== pointerId) return;
  if (!scrubbing.value) return;
  pointerId = null;
  rect = null;
  scrubbing.value = false;
  readingScrubbing.value = false;
  analyticsService.capture("reading_scrubbed", {
    sections_count: items.value.length,
    from_progress: Math.round(startProgress * 100) / 100,
    to_progress: Math.round(scrubbed.value * 100) / 100,
  });
}

// A title reached under the finger answers like a notch.
watch(current, (now, before) => {
  if (scrubbing.value && now !== before) haptic("tick");
});

onUnmounted(() => {
  if (scrubbing.value) readingScrubbing.value = false;
});

/**
 * The bubble of titles rides above the finger: centered on the thumb, held
 * inside the screen near its edges, its pointer always on the thumb.
 */
const BUBBLE_WIDTH = 256;
const bubble = computed(() => {
  const width = Math.min(BUBBLE_WIDTH, stripWidth.value - 32);
  const share = rtl.value ? 1 - progress.value : progress.value;
  const place = bubblePlacement(share * stripWidth.value, stripWidth.value, BUBBLE_WIDTH);
  return {
    style: { left: `${place.left}px`, width: `${width}px` },
    caret: { left: `${place.caret}px` },
  };
});

/** The titles near the reading line, placed on the arc. */
const arc = computed(() =>
  items.value.flatMap((section, index) => {
    const distance = index - position.value;
    if (Math.abs(distance) >= ARC_REACH) return [];
    const place = arcPlacement(distance, rtl.value);
    return [
      {
        section,
        current: Math.abs(distance) < 0.5,
        style: {
          left: `${50 + place.x * 100}%`,
          opacity: place.opacity,
          transform: `translate(-50%, -50%) translateY(${place.y}px) rotate(${place.rotate}deg) scale(${place.scale})`,
          zIndex: 10 - Math.round(Math.abs(distance) * 2),
        },
      },
    ];
  }),
);

/** The share reached: « 42 % » in French, the sign never cut from its number. */
const percent = computed(() =>
  new Intl.NumberFormat(locale.value, { style: "percent", maximumFractionDigits: 0 }).format(
    progress.value,
  ),
);
</script>

<template>
  <div class="fixed inset-x-0 z-40 pointer-events-none" :class="bottomClass">
    <!-- The titles of the text, while the bar slides: on an arc above it. -->
    <transition name="scrub-panel">
      <div
        v-if="scrubbing"
        class="scrub-panel absolute bottom-full mb-4"
        :style="bubble.style"
        aria-hidden="true"
      >
        <!-- The pointer of the bubble, on the thumb. -->
        <span class="scrub-caret" :style="bubble.caret"></span>
        <div class="absolute inset-0 overflow-hidden rounded-xl bg-surface shadow-pop">
          <template v-if="arc.length">
            <!-- Where one stands, always in the middle above the titles: the
               titles say which passage, the share says how far into it. -->
            <p class="scrub-percent">{{ percent }}</p>
            <div
              v-for="item in arc"
              :key="item.section.anchor"
              class="scrub-title"
              :class="{ 'scrub-title-current': item.current }"
              :style="item.style"
            >
              <span class="scrub-label">{{ item.section.label }}</span>
              <span v-if="item.section.hebrew" class="scrub-he" dir="rtl">{{
                item.section.hebrew
              }}</span>
            </div>
          </template>
          <p
            v-else
            class="flex h-full items-center justify-center font-display text-3xl font-bold text-text-primary"
          >
            {{ percent }}
          </p>
        </div>
      </div>
    </transition>

    <!-- The strip that catches the finger: taller than the line it carries,
         which a finger would never hit. Two touches in a row on it are two
         slides: the double tap that starts the automatic scrolling stays off
         it (data-own-gestures, see useAutoScroll). -->
    <div
      class="scrub-strip relative flex h-5 items-end"
      data-own-gestures
      :class="interactive ? 'pointer-events-auto cursor-pointer' : ''"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="endScrub"
      @pointercancel="endScrub"
      @lostpointercapture="endScrub"
    >
      <div
        class="relative w-full bg-black/5 transition-[height] duration-150 dark:bg-white/10"
        :class="scrubbing ? 'h-1.5' : 'h-1'"
        role="progressbar"
        :aria-valuenow="Math.round(progress * 100)"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <!-- scaleX rather than width: the fill follows every scroll frame, an
             animated width would restart layout and paint at each one; the
             transform stays on the compositor. -->
        <div
          class="h-full w-full origin-left bg-primary/80 rtl:origin-right"
          :style="{ transform: `scaleX(${progress})` }"
        ></div>
        <!-- Under the finger, a round thumb says what is being held. -->
        <div
          v-if="scrubbing"
          class="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-primary shadow-pop ltr:-translate-x-1/2 rtl:translate-x-1/2"
          :style="rtl ? { right: `${progress * 100}%` } : { left: `${progress * 100}%` }"
        ></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrub-strip {
  touch-action: none;
}

.scrub-panel {
  height: 7.5rem;
}

/* A small square turned on its point, half under the bubble: the bubble
   points at the finger. */
.scrub-caret {
  position: absolute;
  bottom: -0.35rem;
  width: 0.8rem;
  height: 0.8rem;
  transform: translateX(-50%) rotate(45deg);
  background-color: var(--color-surface);
  box-shadow: var(--shadow-pop);
}

.scrub-percent {
  position: absolute;
  top: 0.55rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.8rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary);
}

/* A title of the arc: anchored at its middle, it is the transform that
   places it, tilts it and sizes it; nothing here is animated, the finger
   drives it. */
.scrub-title {
  position: absolute;
  top: 56%;
  display: flex;
  width: 56%;
  flex-direction: column;
  align-items: center;
  text-align: center;
  will-change: transform, opacity;
}

.scrub-label {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.15;
  color: var(--color-text-primary);
  transition: color 0.15s ease;
}

/* The title the reading line stands on takes the color, solid (see "What you
   come looking for takes the color, solid"). */
.scrub-title-current .scrub-label {
  color: var(--color-primary);
}

.scrub-he {
  margin-top: 0.15rem;
  font-family: var(--font-hebrew);
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.scrub-panel-enter-active {
  transition:
    opacity 0.15s ease-out,
    transform 0.2s cubic-bezier(0.3, 1.3, 0.55, 1);
}

.scrub-panel-leave-active {
  transition:
    opacity 0.15s ease-in,
    transform 0.15s ease-in;
}

.scrub-panel-enter-from,
.scrub-panel-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (prefers-reduced-motion: reduce) {
  .scrub-panel-enter-from,
  .scrub-panel-leave-to {
    transform: none;
  }
}
</style>
