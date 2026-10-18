<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { isNativeApp } from "../composables/useNativeApp";
import { useScrollFrame } from "../composables/useScrollFrame";
import { useMiniPlayerVisible } from "../composables/useAudioPlayer";
import { prefersReducedMotion } from "../composables/useMotion";
import {
  readingScrubbing,
  readingSections,
  useSectionPosition,
} from "../composables/useReadingNav";
import {
  BUMP_HEIGHT,
  TITLE_REACH,
  TITLE_SPACING,
  bumpHeight,
  scrubFraction,
  stepSpring,
  titlePlacement,
  type Spring,
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
 * one gesture instead of three screens of scrolling.
 *
 * The finger pulls the line: under it, the bar rises in a bump, like a string
 * held between two fingers, and follows it with a little give. The titles of
 * the text (the landmarks of the reading menu) sit on the line, with no
 * frame: the one being read rides on top of the bump, large, with the share
 * reached above the finger; the others lie along the bar on each side,
 * small, and climb the slope as they come nearer, growing until they are on
 * top. Let go, the line springs back flat. See docs/design.md, "The progress
 * bar takes you through the text".
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
let startProgress = 0;
/** The width of the strip (the screen's): the line is drawn across it. */
const width = ref(0);

/**
 * The motion of the line, frame by frame: where the bump stands (`peak`,
 * following the finger with a little give), how far it is pulled (`lift`,
 * from 0 to 1, bouncing back when let go), and the rank the titles show
 * (`rank`, gliding from one title to the next rather than jumping).
 */
const peak: Spring = { value: 0, velocity: 0 };
const lift: Spring = { value: 0, velocity: 0 };
const rank: Spring = { value: 0, velocity: 0 };
const pose = shallowRef({ peakX: 0, lift: 0, rank: 0 });
let raf = 0;
let lastFrame = 0;

/** Where the finger is along the strip, in pixels from its left. */
const fingerX = computed(() => (rtl.value ? 1 - scrubbed.value : scrubbed.value) * width.value);

function animate(now: number): void {
  const dt = Math.min(0.032, Math.max(0.001, (now - lastFrame) / 1000));
  lastFrame = now;
  if (prefersReducedMotion()) {
    // Less motion: the line goes straight where it is going, no give.
    Object.assign(peak, { value: fingerX.value, velocity: 0 });
    Object.assign(lift, { value: scrubbing.value ? 1 : 0, velocity: 0 });
    Object.assign(rank, { value: position.value, velocity: 0 });
  } else {
    stepSpring(peak, fingerX.value, dt, 900, 0.8);
    // Pulled firmly; let go, it snaps back with a small rebound.
    if (scrubbing.value) stepSpring(lift, 1, dt, 320, 0.7);
    else stepSpring(lift, 0, dt, 420, 0.32);
    stepSpring(rank, position.value, dt, 380, 1);
  }
  pose.value = { peakX: peak.value, lift: Math.max(0, lift.value), rank: rank.value };
  const settled =
    !scrubbing.value && Math.abs(lift.value) < 0.004 && Math.abs(lift.velocity) < 0.02;
  if (settled) {
    lift.value = 0;
    lift.velocity = 0;
    pose.value = { ...pose.value, lift: 0 };
    raf = 0;
    return;
  }
  raf = requestAnimationFrame(animate);
}

function startAnimation(): void {
  if (raf) return;
  lastFrame = performance.now();
  raf = requestAnimationFrame(animate);
}

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
  width.value = rect.width;
  rtl.value = getComputedStyle(strip).direction === "rtl";
  startProgress = scrollFrame.value.progress;
  // The titles may have moved since the last measure (an image, a fold).
  remeasure();
  scrubbing.value = true;
  readingScrubbing.value = true;
  moveTo(e.clientX);
  // A line at rest starts from the finger; one still bouncing keeps going.
  if (!raf) {
    Object.assign(peak, { value: fingerX.value, velocity: 0 });
    Object.assign(rank, { value: position.value, velocity: 0 });
  }
  startAnimation();
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
  startAnimation();
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
  if (raf) cancelAnimationFrame(raf);
  if (scrubbing.value) readingScrubbing.value = false;
});

/** The line is pulled: it is drawn, and the flat bar steps aside. */
const pulled = computed(() => pose.value.lift > 0.001);

/** The height of the stage above the bar: the bump, then the title on top. */
const STAGE = BUMP_HEIGHT + 120;
/** The bar's own thickness, and where its middle lies in the stage. */
const STROKE = 5;
const BASELINE = STAGE - STROKE / 2;

/**
 * The line, sampled across the strip: `done` up to the bump (the share
 * read, in the primary color), `rest` beyond, and `hill` the paper under it,
 * which hides the text the line rises over.
 */
const line = computed(() => {
  const { peakX, lift: l } = pose.value;
  const w = width.value;
  const points: [number, number][] = [];
  for (let x = 0; x <= w; x += 4) points.push([x, BASELINE - bumpHeight(x, peakX, l)]);
  points.push([w, BASELINE - bumpHeight(w, peakX, l)]);
  const at = (p: [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const before = points.filter(([x]) => x <= peakX);
  const after = points.filter(([x]) => x >= peakX);
  const top: [number, number] = [peakX, BASELINE - bumpHeight(peakX, peakX, l)];
  const left = [...before, top].map(at).join(" L");
  const right = [top, ...after].map(at).join(" L");
  const [done, rest] = rtl.value ? [right, left] : [left, right];
  return {
    done: `M${done}`,
    rest: `M${rest}`,
    hill: `M0,${STAGE} L${points.map(at).join(" L")} L${w},${STAGE} Z`,
    thumb: top,
  };
});

/** The titles near the reading line, placed on it. */
const titles = computed(() => {
  const { peakX, lift: l, rank: r } = pose.value;
  return items.value.flatMap((section, index) => {
    const distance = index - r;
    if (Math.abs(distance) >= TITLE_REACH) return [];
    const place = titlePlacement(distance, peakX, l, rtl.value);
    if (place.x < -80 || place.x > width.value + 80) return [];
    const isCurrent = Math.abs(distance) < 0.5;
    // The title stands above the line; the one on top leaves room for the
    // share reached, between it and the finger.
    const nearness = Math.exp(-((distance / 0.6) ** 2));
    const gap = 10 + 22 * nearness;
    // The title on top hangs from its middle, or, near an edge of the
    // screen, from the side that keeps it whole: at 90 % of the bar, it
    // reaches 90 % of its width to the left.
    const share = width.value > 0 ? Math.min(1, Math.max(0, place.x / width.value)) : 0.5;
    const anchor = 0.5 + (share - 0.5) * nearness;
    return [
      {
        section,
        current: isCurrent,
        style: {
          // A title lying on the line keeps to its share of it, so that two
          // neighbors never overlap; the one coming on top takes the room.
          maxWidth: `${(TITLE_SPACING - 14) / place.scale + nearness * width.value * 0.84}px`,
          opacity: place.opacity,
          transform: `translate(${place.x}px, ${BASELINE - place.rise - gap}px) translate(-${anchor * 100}%, -100%) rotate(${place.rotate}deg) scale(${place.scale})`,
          transformOrigin: `${anchor * 100}% 100%`,
          zIndex: 10 - Math.round(Math.abs(distance) * 2),
        },
      },
    ];
  });
});

/** The share reached, on top of the bump, just above the finger. */
const percentStyle = computed(() => {
  const { peakX, lift: l } = pose.value;
  return {
    opacity: Math.min(1, l),
    transform: `translate(${peakX}px, ${BASELINE - bumpHeight(peakX, peakX, l) - 8}px) translate(-50%, -100%)`,
  };
});

/** The share reached: « 42 % » in French, the sign never cut from its number. */
const percent = computed(() =>
  new Intl.NumberFormat(locale.value, { style: "percent", maximumFractionDigits: 0 }).format(
    progress.value,
  ),
);
</script>

<template>
  <div class="fixed inset-x-0 z-40 pointer-events-none" :class="bottomClass">
    <!-- The line pulled up under the finger, and the titles on it. -->
    <div
      v-if="pulled"
      class="scrub-stage absolute inset-x-0 bottom-0"
      :style="{ height: `${STAGE}px` }"
      aria-hidden="true"
    >
      <svg class="absolute inset-0 overflow-visible" :width="width" :height="STAGE">
        <path :d="line.hill" class="scrub-hill" />
        <path :d="line.rest" class="scrub-rest" :stroke-width="STROKE" />
        <path :d="line.done" class="scrub-done" :stroke-width="STROKE" />
        <circle :cx="line.thumb[0]" :cy="line.thumb[1]" r="7" class="scrub-thumb" />
      </svg>
      <div
        v-for="item in titles"
        :key="item.section.anchor"
        class="scrub-title"
        :class="{ 'scrub-title-current': item.current }"
        :style="item.style"
      >
        <span class="scrub-label">{{ item.section.label }}</span>
        <span v-if="item.section.hebrew" class="scrub-he" dir="rtl">{{ item.section.hebrew }}</span>
      </div>
      <!-- Where one stands, always in the middle of the gesture, above the
           finger: the titles say which passage, the share says how far into
           the text. Alone, large, on a text without titles. -->
      <p
        class="scrub-percent"
        :class="{ 'scrub-percent-alone': !items.length }"
        :style="percentStyle"
      >
        {{ percent }}
      </p>
    </div>

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
        class="relative h-1 w-full bg-black/5 dark:bg-white/10"
        :class="{ invisible: pulled }"
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
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrub-strip {
  touch-action: none;
}

/* The paper under the pulled line: the text it rises over goes under it. */
.scrub-hill {
  fill: var(--color-page);
}

.scrub-done,
.scrub-rest {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.scrub-done {
  stroke: var(--color-primary);
}

.scrub-rest {
  stroke: color-mix(in srgb, var(--color-text-primary) 12%, var(--color-page));
}

.scrub-thumb {
  fill: var(--color-primary);
}

/* A title on the line: anchored at its foot, it is the transform that places
   it, tilts it with the line and sizes it; nothing here is animated, the
   finger drives it. No frame: a halo of the page's color keeps it legible
   over the text. */
.scrub-title,
.scrub-percent {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 50% 100%;
  will-change: transform, opacity;
  text-shadow:
    0 0 2px var(--color-page),
    0 0 4px var(--color-page),
    0 0 8px var(--color-page),
    0 0 12px var(--color-page);
}

.scrub-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.scrub-label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-display);
  font-size: 1.6rem;
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
  margin-top: 0.1rem;
  font-family: var(--font-hebrew);
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.scrub-percent {
  font-size: 0.8rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.scrub-percent-alone {
  font-family: var(--font-display);
  font-size: 1.9rem;
  color: var(--color-primary);
}
</style>
