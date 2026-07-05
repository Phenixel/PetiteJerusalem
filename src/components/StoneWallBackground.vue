<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

/* Jerusalem-stone wall, hidden behind the whole app.
   The stones themselves are invisible: what you see is a warm light that
   drifts slowly BEHIND the wall and seeps through the mortar joints. Where
   the light passes, the joints glow softly and the stones read as dark
   silhouettes — you guess the wall rather than see it. A faint mineral
   grain covers everything, and the wall drifts slightly on scroll.

   Implementation: the generated stone outlines are only ever used inside
   two masks — one keeping the joints (light between the stones), one
   keeping the faces (a much fainter wash on the stone themselves). Two
   radial-gradient blobs wander inside those masked groups; the masks stay
   fixed to the wall, so the light moves behind a static stone layout. */

const VIEW_W = 1600;
const VIEW_H = 1100;

/** Extra SVG height (px) so the parallax drift never uncovers the bottom. */
const OVERSCAN = 240;
const PARALLAX = 0.06;

interface Stone {
  id: number;
  d: string;
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

const rand = mulberry32(40917);
const between = (min: number, max: number) => min + rand() * (max - min);

/** Hand-hewn stone outline: inset the cell a little (the mortar joint),
    jitter the corners, and break every edge with wobbly midpoints. */
function stonePath(x: number, y: number, w: number, h: number): string {
  const inset = between(2.5, 4.5);
  const jitter = () => between(-2.2, 2.2);
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
    const mids = rand() < 0.5 ? 1 : 2;
    for (let m = 1; m <= mids; m++) {
      const t = m / (mids + 1);
      const wob = between(-1.8, 1.8);
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

/** Tight coursed masonry: rows of varying heights, stones of varying widths,
    a few cells split into two small stacked stones like on the Kotel. */
function buildWall(): Stone[] {
  const stones: Stone[] = [];
  let id = 0;
  let y = -between(10, 40);

  while (y < VIEW_H) {
    const courseH = between(48, 100);
    let x = -between(20, 100);
    while (x < VIEW_W) {
      const w = courseH * between(1.15, 2.3);
      if (courseH > 62 && rand() < 0.18) {
        const split = courseH * between(0.42, 0.58);
        stones.push({ id: id++, d: stonePath(x, y, w, split) });
        stones.push({ id: id++, d: stonePath(x, y + split, w, courseH - split) });
      } else {
        stones.push({ id: id++, d: stonePath(x, y, w, courseH) });
      }
      x += w;
    }
    y += courseH;
  }
  return stones;
}

const stones = buildWall();

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
      <defs>
        <radialGradient id="sw-glow">
          <stop class="sw-glow-stop" offset="0" stop-opacity="0.85" />
          <stop class="sw-glow-stop" offset="0.45" stop-opacity="0.35" />
          <stop class="sw-glow-stop" offset="1" stop-opacity="0" />
        </radialGradient>
        <filter id="sw-soften" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <filter id="sw-soften-more" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id="sw-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.5  0 0 0 0 0.47  0 0 0 0 0.42  0.4 0.4 0.4 0 0"
          />
          <feComposite operator="in" in2="SourceGraphic" />
        </filter>
        <!-- Light between the stones: everything is lit except the stones. -->
        <mask id="sw-joints">
          <g filter="url(#sw-soften)">
            <rect x="0" y="0" :width="VIEW_W" :height="VIEW_H" fill="white" />
            <path v-for="s in stones" :key="s.id" :d="s.d" fill="black" />
          </g>
        </mask>
        <!-- Faint wash on the stone faces themselves. -->
        <mask id="sw-faces">
          <g filter="url(#sw-soften-more)">
            <rect x="0" y="0" :width="VIEW_W" :height="VIEW_H" fill="black" />
            <path v-for="s in stones" :key="s.id" :d="s.d" fill="white" />
          </g>
        </mask>
      </defs>

      <rect class="sw-grain" x="0" y="0" :width="VIEW_W" :height="VIEW_H" filter="url(#sw-grain)" />

      <g class="sw-light sw-light--faces" mask="url(#sw-faces)">
        <circle class="sw-blob sw-blob--a" r="480" fill="url(#sw-glow)" />
        <circle class="sw-blob sw-blob--b" r="360" fill="url(#sw-glow)" />
      </g>
      <g class="sw-light sw-light--joints" mask="url(#sw-joints)">
        <circle class="sw-blob sw-blob--a" r="480" fill="url(#sw-glow)" />
        <circle class="sw-blob sw-blob--b" r="360" fill="url(#sw-glow)" />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.stone-wall {
  --sw-glow-rgb: 186 137 66;
  --sw-joints-a: 0.55;
  --sw-faces-a: 0.1;
  --sw-grain-a: 0.05;
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

:root.dark .stone-wall {
  --sw-glow-rgb: 235 214 165;
  --sw-joints-a: 0.33;
  --sw-faces-a: 0.06;
  --sw-grain-a: 0.06;
}

.stone-wall__svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: calc(100% + 240px);
  will-change: transform;
}

.sw-glow-stop {
  stop-color: rgb(var(--sw-glow-rgb));
}

.sw-grain {
  fill: #fff;
  opacity: var(--sw-grain-a);
}

.sw-light--joints {
  opacity: var(--sw-joints-a);
}

.sw-light--faces {
  opacity: var(--sw-faces-a);
}

/* The light wanders behind the wall; the masks stay fixed to the stones. */
.sw-blob--a {
  transform: translate(640px, 640px);
  animation: sw-drift-a 85s ease-in-out infinite;
}

.sw-blob--b {
  transform: translate(900px, 300px);
  animation: sw-drift-b 115s ease-in-out infinite;
  animation-delay: -45s;
}

@keyframes sw-drift-a {
  0% {
    transform: translate(250px, 280px);
    opacity: 0.35;
  }
  20% {
    opacity: 0.9;
  }
  30% {
    transform: translate(640px, 640px);
  }
  55% {
    transform: translate(1230px, 430px);
    opacity: 0.75;
  }
  70% {
    opacity: 0.25;
  }
  80% {
    transform: translate(830px, 180px);
    opacity: 0.6;
  }
  100% {
    transform: translate(250px, 280px);
    opacity: 0.35;
  }
}

@keyframes sw-drift-b {
  0% {
    transform: translate(1350px, 780px);
    opacity: 0.3;
  }
  25% {
    transform: translate(900px, 300px);
    opacity: 0.8;
  }
  50% {
    transform: translate(420px, 720px);
    opacity: 0.5;
  }
  75% {
    transform: translate(1050px, 900px);
    opacity: 0.85;
  }
  100% {
    transform: translate(1350px, 780px);
    opacity: 0.3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sw-blob--a,
  .sw-blob--b {
    animation: none;
    opacity: 0.4;
  }
}
</style>
