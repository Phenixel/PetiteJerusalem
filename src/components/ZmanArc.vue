<script setup lang="ts">
/**
 * The cycle of a day around a moment of prayer: the sun's course over the
 * horizon, from sunrise on the left to sunset on the right, and the night
 * under it, back from sunset to sunrise. Every hour has its place on it, so
 * now always shows: the sun by day, the moon by night.
 *
 * On it, the moment's window in the theme color (what has passed of it a
 * shade deeper), each landmark as a dot with its short name, and the rest of
 * the cycle as a dashed bar in the danger color: outside its time. Read at a
 * glance: where the moment is, where we are, and whether this is the time.
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
/** Room on either side for sunrise and sunset, written on the horizon. */
const SIDE = 54;
const RX = (WIDTH - 2 * SIDE) / 2;
const CX = WIDTH / 2;
/** The day rises higher than the night sinks: the sky is what we look at. */
const RY_DAY = 74;
const RY_NIGHT = 46;
const BASE = RY_DAY + 26;
const HEIGHT = BASE + RY_NIGHT + 24;

/** A place in the cycle (see arcPosition): -1 to 0 the night before, 0 to 1 the day, 1 to 2 the night after. */
function point(s: number): [number, number] {
  const angle = Math.PI * (1 - s);
  const sin = Math.sin(angle);
  return [CX + RX * Math.cos(angle), BASE - (sin >= 0 ? RY_DAY : RY_NIGHT) * sin];
}

const at = (date: Date) => arcPosition(props.plan, date);

function path(from: number, to: number): string {
  if (to <= from) return "";
  const steps = Math.max(2, Math.ceil((to - from) * 90));
  return Array.from({ length: steps + 1 }, (_, i) => point(from + ((to - from) * i) / steps))
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join("");
}

/** The whole cycle, once round: what is not the moment's window. */
const outside = path(0, 2);

const nowS = computed(() => at(props.now));
const opening = computed(() => ({ from: at(props.plan.start), to: at(props.plan.end) }));
const windowPath = computed(() => path(opening.value.from, opening.value.to));
/** What has passed of the window, a shade deeper. */
const elapsed = computed(() =>
  path(opening.value.from, Math.min(Math.max(nowS.value, opening.value.from), opening.value.to)),
);

const marker = computed(() => point(nowS.value));
/** By day, the sun; by night, the moon. */
const isDay = computed(() => nowS.value >= 0 && nowS.value <= 1);

/**
 * The landmarks, with their short name set outside the cycle, away from its
 * center. A name gives way when it would touch the previous one, the sun,
 * or the horizon where sunrise and sunset are written; the list under the
 * drawing says them all.
 */
const marks = computed(() => {
  let last: [number, number] | null = null;
  return props.plan.marks.map((mark: ZmanMark) => {
    const [x, y] = point(at(mark.date));
    const dx = (x - CX) / RX;
    const dy = (y - BASE) / (y < BASE ? RY_DAY : RY_NIGHT);
    const norm = Math.hypot(dx, dy) || 1;
    let lx = x + (dx / norm) * 14;
    let ly = y + (dy / norm) * 14 + 3.5;
    let anchor = dx / norm < -0.35 ? "end" : dx / norm > 0.35 ? "start" : "middle";
    // Near a side, the name goes inside the cycle rather than over sunrise or sunset.
    if (anchor === "end" && lx < SIDE + 26) [anchor, lx, ly] = ["start", x + 9, y + 4];
    if (anchor === "start" && lx > WIDTH - SIDE - 26) [anchor, lx, ly] = ["end", x - 9, y + 4];
    const clear =
      Math.abs(y - BASE) > 10 &&
      (!last || Math.hypot(lx - last[0], ly - last[1]) >= 46) &&
      Math.hypot(lx - marker.value[0], ly - marker.value[1]) >= 24;
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

const sunrise = computed(() => props.clock(props.plan.cycle.sunrise));
const sunset = computed(() => props.clock(props.plan.cycle.sunset));
</script>

<template>
  <div>
    <svg
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      class="zman-arc"
      direction="ltr"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <line x1="0" :y1="BASE" :x2="WIDTH" :y2="BASE" class="horizon" />
      <path :d="outside" class="outside" />
      <path :d="windowPath" class="window" />
      <path v-if="elapsed" :d="elapsed" class="elapsed" />
      <g v-for="mark in marks" :key="mark.key">
        <circle :cx="mark.x" :cy="mark.y" r="3.4" class="dot" />
        <text v-if="mark.label" :x="mark.lx" :y="mark.ly" class="label" :text-anchor="mark.anchor">
          {{ mark.label }}
        </text>
      </g>
      <g>
        <template v-if="isDay">
          <circle :cx="marker[0]" :cy="marker[1]" r="15" class="sun-halo" />
          <circle :cx="marker[0]" :cy="marker[1]" r="9" class="sun" />
          <circle :cx="marker[0]" :cy="marker[1]" r="5.5" class="sun-core" />
        </template>
        <template v-else>
          <circle :cx="marker[0]" :cy="marker[1]" r="13" class="moon-halo" />
          <circle :cx="marker[0]" :cy="marker[1]" r="8.5" class="moon" />
          <circle :cx="marker[0] + 3.6" :cy="marker[1] - 2.8" r="7" class="moon-shadow" />
        </template>
      </g>
      <!-- Sunrise and sunset, on the horizon, at either side of the cycle. -->
      <text :x="SIDE / 2" :y="BASE - 5" class="end-name" text-anchor="middle">
        {{ t("textReading.zman.arc.sunrise") }}
      </text>
      <text :x="SIDE / 2" :y="BASE + 12" class="end-time" text-anchor="middle">
        {{ sunrise }}
      </text>
      <text :x="WIDTH - SIDE / 2" :y="BASE - 5" class="end-name" text-anchor="middle">
        {{ t("textReading.zman.arc.sunset") }}
      </text>
      <text :x="WIDTH - SIDE / 2" :y="BASE + 12" class="end-time" text-anchor="middle">
        {{ sunset }}
      </text>
    </svg>

    <!-- What the colors say. -->
    <ul class="zman-legend">
      <li>
        <span class="swatch swatch-window" aria-hidden="true" />{{
          t("textReading.zman.legend.window")
        }}
      </li>
      <li>
        <span class="swatch swatch-outside" aria-hidden="true" />{{
          t("textReading.zman.legend.outside")
        }}
      </li>
      <li>
        <span class="swatch" :class="isDay ? 'swatch-sun' : 'swatch-moon'" aria-hidden="true" />{{
          t("textReading.zman.now")
        }}
      </li>
    </ul>
  </div>
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
/* Outside its time: a dashed bar in the danger color, set back. */
.outside {
  fill: none;
  stroke: color-mix(in srgb, var(--color-danger) 55%, transparent);
  stroke-width: 4;
  stroke-dasharray: 5 4;
}
.window,
.elapsed {
  fill: none;
  stroke-width: 7;
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
.end-name {
  font-size: 10px;
  font-weight: 700;
  fill: var(--color-text-secondary);
}
.end-time {
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
.moon-halo {
  fill: #26345a;
  opacity: 0.14;
}
.moon {
  fill: #d9c98f;
}
.moon-shadow {
  fill: var(--color-surface);
}

.zman-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.35rem 1rem;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}
.zman-legend li {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.swatch {
  display: inline-block;
  flex: none;
}
.swatch-window {
  width: 1.1rem;
  height: 0.4rem;
  border-radius: var(--radius-pill);
  background: var(--color-brand);
}
.swatch-outside {
  width: 1.1rem;
  border-top: 3px dashed color-mix(in srgb, var(--color-danger) 55%, transparent);
}
.swatch-sun {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: var(--radius-pill);
  background: #f39233;
}
.swatch-moon {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: var(--radius-pill);
  background: #d9c98f;
}
</style>
