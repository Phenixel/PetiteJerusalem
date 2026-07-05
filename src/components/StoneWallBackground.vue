<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

/* Jerusalem-stone wall, drawn behind the whole app on the beige background.
   The wall is generated once (seeded PRNG, so it is identical on every
   load): courses of varying heights, stones of varying widths — some cells
   split into two small stacked stones like on the Kotel — and every edge is
   slightly crooked, like hand-hewn stone. Two very quiet effects on top:
   - a handful of stone outlines are traced by a thin travelling light, one
     after the other, as if the stones were sketching themselves;
   - the whole wall drifts a little slower than the page on scroll. */

const VIEW_W = 1600;
const VIEW_H = 1100;

/** Extra SVG height (px) so the parallax drift never uncovers the bottom. */
const OVERSCAN = 240;
const PARALLAX = 0.06;

interface Stone {
  id: number;
  d: string;
  fillOpacity: number;
}

interface Trace {
  id: number;
  d: string;
  dash: number;
  dur: number;
  delay: number;
}

/* Deterministic PRNG (mulberry32) — the wall must not change between visits. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(5786);
const between = (min: number, max: number) => min + rand() * (max - min);

/** Hand-hewn stone outline: inset the cell a little (the mortar joint),
    jitter the corners, and break every edge with wobbly midpoints. */
function stonePath(x: number, y: number, w: number, h: number): string {
  const inset = between(3, 5.5);
  const jitter = () => between(-3, 3);
  const corners: Array<[number, number]> = [
    [x + inset + jitter(), y + inset + jitter()],
    [x + w - inset + jitter(), y + inset + jitter()],
    [x + w - inset + jitter(), y + h - inset + jitter()],
    [x + inset + jitter(), y + h - inset + jitter()],
  ];
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = corners[i];
    const [bx, by] = corners[(i + 1) % 4];
    pts.push([ax, ay]);
    // 1 or 2 midpoints per edge, pushed slightly off the straight line.
    const mids = rand() < 0.5 ? 1 : 2;
    for (let m = 1; m <= mids; m++) {
      const t = m / (mids + 1);
      const wob = between(-2.5, 2.5);
      // Perpendicular offset (edges are near-axis-aligned, so swap suffices).
      const horizontal = Math.abs(bx - ax) > Math.abs(by - ay);
      pts.push([
        ax + (bx - ax) * t + (horizontal ? 0 : wob),
        ay + (by - ay) * t + (horizontal ? wob : 0),
      ]);
    }
  }
  return (
    pts.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`).join("") +
    "Z"
  );
}

function buildWall(): { stones: Stone[]; traces: Trace[] } {
  const stones: Stone[] = [];
  const cells: Array<{ x: number; y: number; w: number; h: number }> = [];
  let id = 0;
  let y = -between(20, 60);

  while (y < VIEW_H) {
    const courseH = between(72, 150);
    let x = -between(20, 120);
    while (x < VIEW_W) {
      const w = courseH * between(1.2, 2.6);
      // Like on the Kotel: a few cells hold two small stacked stones.
      if (courseH > 95 && rand() < 0.16) {
        const split = courseH * between(0.42, 0.58);
        cells.push({ x, y, w, h: split });
        cells.push({ x, y: y + split, w, h: courseH - split });
      } else {
        cells.push({ x, y, w, h: courseH });
      }
      x += w;
    }
    y += courseH;
  }

  for (const c of cells) {
    stones.push({
      id: id++,
      d: stonePath(c.x, c.y, c.w, c.h),
      // Barely-there face tint; some stones are outline-only.
      fillOpacity: rand() < 0.25 ? 0 : between(0.008, 0.024),
    });
  }

  // A scattered handful of stones get the travelling-light trace.
  const traces: Trace[] = [];
  const step = Math.floor(stones.length / 12);
  for (let i = Math.floor(step / 2); i < stones.length && traces.length < 12; i += step) {
    const s = stones[Math.min(i + Math.floor(between(0, step * 0.8)), stones.length - 1)];
    traces.push({
      id: s.id,
      d: s.d,
      dash: between(10, 22),
      dur: between(10, 18),
      delay: between(0, 40),
    });
  }
  return { stones, traces };
}

const { stones, traces } = buildWall();

const offset = ref(0);
let rafId = 0;

function onScroll() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    offset.value = Math.min(window.scrollY * PARALLAX, OVERSCAN - 20);
  });
}

onMounted(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  window.addEventListener("scroll", onScroll, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScroll);
  if (rafId) cancelAnimationFrame(rafId);
});
</script>

<template>
  <div class="stone-wall" aria-hidden="true">
    <svg
      class="stone-wall__svg"
      :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
      preserveAspectRatio="xMidYMin slice"
      :style="{ transform: `translate3d(0, ${-offset}px, 0)` }"
    >
      <path
        v-for="s in stones"
        :key="s.id"
        class="stone-wall__stone"
        :d="s.d"
        :fill-opacity="s.fillOpacity"
      />
      <path
        v-for="t in traces"
        :key="`t${t.id}`"
        class="stone-wall__trace"
        :d="t.d"
        pathLength="100"
        :style="{
          strokeDasharray: `${t.dash} ${100 - t.dash}`,
          animationDuration: `${t.dur}s`,
          animationDelay: `${t.delay}s`,
        }"
      />
    </svg>
  </div>
</template>

<style scoped>
.stone-wall {
  --wall-ink: #57492c;
  --wall-line-a: 0.045;
  --wall-trace-rgb: 167 133 71;
  --wall-trace-a: 0.4;
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

:root.dark .stone-wall {
  --wall-ink: #d6d3c8;
  --wall-line-a: 0.035;
  --wall-trace-rgb: 222 205 160;
  --wall-trace-a: 0.22;
}

.stone-wall__svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: calc(100% + 240px);
  will-change: transform;
}

.stone-wall__stone {
  fill: var(--wall-ink);
  stroke: var(--wall-ink);
  stroke-opacity: var(--wall-line-a);
  stroke-width: 1.4;
  stroke-linejoin: round;
}

/* Thin light travelling along a stone's crooked outline: draws in, runs the
   full perimeter, fades out, then rests for the tail of its cycle. */
.stone-wall__trace {
  fill: none;
  stroke: rgb(var(--wall-trace-rgb) / var(--wall-trace-a));
  stroke-width: 1.6;
  stroke-linejoin: round;
  stroke-linecap: round;
  opacity: 0;
  animation-name: stone-wall-trace;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes stone-wall-trace {
  0% {
    stroke-dashoffset: 200;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  58% {
    opacity: 1;
  }
  70%,
  100% {
    stroke-dashoffset: 0;
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stone-wall__trace {
    animation: none;
  }
}
</style>
