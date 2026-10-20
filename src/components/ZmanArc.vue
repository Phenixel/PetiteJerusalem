<script setup lang="ts">
/**
 * The course of the sun over a moment of prayer: the day's arc from sunrise
 * to sunset (or, for Arvit and the Sli'hot, the night's, from sunset to
 * sunrise), the moment's window traced on it, what has passed of it in the
 * theme color, each landmark as a dot, and the sun (or the moon, at night)
 * where it is now. Before sunrise, misheyakir falls a little under the
 * horizon: the arc goes on below it, as the sun does.
 *
 * Drawn from left to right in every language: it is the sky's course, not a
 * line of text.
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { arcPosition, type ZmanMark, type ZmanPlan } from "../services/tefilaZman";

const props = defineProps<{
  plan: ZmanPlan;
  now: Date;
  /** Formats a time in the place's time zone. */
  clock: (date: Date) => string;
}>();

const { t } = useI18n();

const WIDTH = 340;
const LEFT = 14;
const RIGHT = WIDTH - 14;
const RX = (RIGHT - LEFT) / 2;
const CX = LEFT + RX;
const RY = 78;
/** The horizon: room above it for the sun's halo and the labels. */
const BASE = RY + 26;
/** How far past either end of the arc it is drawn, at most. */
const OVERRUN = 0.18;

function point(u: number): [number, number] {
  const angle = Math.PI * (1 - u);
  return [CX + RX * Math.cos(angle), BASE - RY * Math.sin(angle)];
}

const at = (date: Date) => arcPosition(props.plan, date);
const clamp = (u: number, min: number, max: number) => Math.min(max, Math.max(min, u));

const nowU = computed(() => at(props.now));

/** The stretch of the arc drawn: the moment's window, its landmarks, now. */
const span = computed(() => {
  const us = [
    0,
    1,
    at(props.plan.start),
    at(props.plan.end),
    ...props.plan.marks.map((m) => at(m.date)),
  ];
  if (nowU.value > -OVERRUN && nowU.value < 1 + OVERRUN) us.push(nowU.value);
  return { min: clamp(Math.min(...us), -OVERRUN, 0), max: clamp(Math.max(...us), 1, 1 + OVERRUN) };
});

function path(from: number, to: number): string {
  if (to <= from) return "";
  const steps = Math.max(2, Math.ceil((to - from) * 80));
  const points = Array.from({ length: steps + 1 }, (_, i) =>
    point(from + ((to - from) * i) / steps),
  );
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
}

const track = computed(() => path(span.value.min, span.value.max));
const windowArc = computed(() => {
  const from = clamp(at(props.plan.start), span.value.min, span.value.max);
  const to = clamp(at(props.plan.end), span.value.min, span.value.max);
  return { from, to, d: path(from, to) };
});
/** What has passed of the window, in the theme color. */
const elapsed = computed(() =>
  path(windowArc.value.from, clamp(nowU.value, windowArc.value.from, windowArc.value.to)),
);

/** The sun (or the moon) is drawn only while it is on the stretch shown. */
const marker = computed(() =>
  nowU.value >= span.value.min && nowU.value <= span.value.max ? point(nowU.value) : null,
);

/**
 * The landmarks, with their short name set outside the arc, away from its
 * center: above the top, beside the sides. A name gives way when it would
 * touch the previous one, sit under the horizon or under the sun; the list
 * under the arc says them all.
 */
const marks = computed(() => {
  let last: [number, number] | null = null;
  return props.plan.marks.map((mark: ZmanMark) => {
    const [x, y] = point(clamp(at(mark.date), span.value.min, span.value.max));
    const dx = (x - CX) / RX;
    const dy = (y - BASE) / RY;
    const norm = Math.hypot(dx, dy) || 1;
    let lx = x + (dx / norm) * 14;
    let ly = y + (dy / norm) * 14 + 3.5;
    let anchor = dx / norm < -0.35 ? "end" : dx / norm > 0.35 ? "start" : "middle";
    // Near an edge of the drawing, the name goes inside the arc instead.
    if (anchor === "end" && lx < 44) [anchor, lx, ly] = ["start", x + 9, y + 4];
    if (anchor === "start" && lx > WIDTH - 44) [anchor, lx, ly] = ["end", x - 9, y + 4];
    const sun = marker.value;
    const clear =
      y < BASE - 12 &&
      (!last || Math.hypot(lx - last[0], ly - last[1]) >= 48) &&
      (!sun || Math.hypot(lx - sun[0], ly - sun[1]) >= 24);
    if (clear) last = [lx, ly];
    return {
      key: mark.key,
      x,
      y,
      label: clear ? t(`textReading.zman.short.${mark.key}`) : "",
      lx,
      ly,
      anchor,
    };
  });
});

/** Below the horizon, the ends of the arc: sunrise and sunset, or the reverse. */
const ends = computed(() =>
  props.plan.night
    ? [
        t("textReading.zman.arc.sunset", { time: props.clock(props.plan.from) }),
        t("textReading.zman.arc.sunrise", { time: props.clock(props.plan.to) }),
      ]
    : [
        t("textReading.zman.arc.sunrise", { time: props.clock(props.plan.from) }),
        t("textReading.zman.arc.sunset", { time: props.clock(props.plan.to) }),
      ],
);

/**
 * The ends' times go under the horizon, and under the arc and the sun where
 * they go below it (misheyakir, before sunrise): never across them.
 */
const endsY = computed(() => {
  const lowest = Math.max(BASE, point(span.value.min)[1], point(span.value.max)[1]);
  // The sun under the horizon, with its halo, before sunrise.
  const sun = marker.value ? marker.value[1] + 12 : 0;
  return Math.max(lowest, sun) + 16;
});
const height = computed(() => endsY.value + 6);
</script>

<template>
  <svg
    :viewBox="`0 0 ${WIDTH} ${height}`"
    class="zman-arc"
    direction="ltr"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <line x1="0" :y1="BASE" :x2="WIDTH" :y2="BASE" class="horizon" />
    <path :d="track" class="track" />
    <path :d="windowArc.d" class="window" />
    <path v-if="elapsed" :d="elapsed" class="elapsed" />
    <g v-for="mark in marks" :key="mark.key">
      <circle :cx="mark.x" :cy="mark.y" r="3.4" class="dot" />
      <text v-if="mark.label" :x="mark.lx" :y="mark.ly" class="label" :text-anchor="mark.anchor">
        {{ mark.label }}
      </text>
    </g>
    <g v-if="marker">
      <template v-if="!plan.night">
        <circle :cx="marker[0]" :cy="marker[1]" r="15" class="sun-halo" />
        <circle :cx="marker[0]" :cy="marker[1]" r="9" class="sun" />
        <circle :cx="marker[0]" :cy="marker[1]" r="5.5" class="sun-core" />
      </template>
      <template v-else>
        <circle :cx="marker[0]" :cy="marker[1]" r="9" class="moon" />
        <circle :cx="marker[0] + 4" :cy="marker[1] - 3" r="7.6" class="moon-shadow" />
      </template>
    </g>
    <text :x="LEFT" :y="endsY" class="end">{{ ends[0] }}</text>
    <text :x="RIGHT" :y="endsY" class="end" text-anchor="end">{{ ends[1] }}</text>
  </svg>
</template>

<style scoped>
.zman-arc {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  font-family: var(--font-sans);
}
.horizon {
  stroke: var(--color-line-strong);
  stroke-width: 1.5;
}
.track {
  fill: none;
  stroke: var(--color-line-strong);
  stroke-width: 2;
  stroke-dasharray: 2 5;
  stroke-linecap: round;
}
.window,
.elapsed {
  fill: none;
  stroke-width: 6;
  stroke-linecap: round;
}
.window {
  stroke: var(--color-brand);
}
.elapsed {
  stroke: var(--color-primary);
}
.dot {
  fill: var(--color-surface);
  stroke: var(--color-primary);
  stroke-width: 1.6;
}
.label {
  font-size: 10px;
  font-weight: 700;
  fill: var(--color-text-secondary);
}
.end {
  font-size: 10.5px;
  fill: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}
/* The sun and the moon keep their own colors, in every theme. */
.sun-halo {
  fill: #f39233;
  opacity: 0.18;
}
.sun {
  fill: #f39233;
}
.sun-core {
  fill: #ffcf5c;
}
.moon {
  fill: #e9dcb4;
}
.moon-shadow {
  fill: var(--color-surface);
}
</style>
