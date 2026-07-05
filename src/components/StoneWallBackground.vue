<script setup lang="ts">
/* Jerusalem-stone wall, hidden behind the whole app.
   The stones themselves are invisible: what you see is a warm light that
   drifts slowly BEHIND the wall and seeps through the mortar joints. Where
   the light passes, the joints glow softly and the stones read as dark
   silhouettes — you guess the wall rather than see it. A faint mineral
   grain covers everything.

   Performance: everything per-frame must stay off the main thread. The
   joint network is baked once into a static SVG data-URI used as a CSS
   `mask-image`, and the light blobs are plain divs animated with
   compositor-friendly transform/opacity only. (The previous SVG-`<mask>`
   version forced a full re-raster of the masked group on every frame and
   dragged the whole site down to ~24 fps.) The wall layer itself never
   moves: a scroll parallax was tried and dropped — it was the only part
   still running JS on every scrolled frame, and moving a masked layer can
   invalidate its cached render surface on modest GPUs, for a barely
   visible effect. */

const VIEW_W = 1600;
const VIEW_H = 1100;

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
function buildWall(): string[] {
  const paths: string[] = [];
  let y = -between(10, 40);

  while (y < VIEW_H) {
    const courseH = between(48, 100);
    let x = -between(20, 100);
    while (x < VIEW_W) {
      const w = courseH * between(1.15, 2.3);
      if (courseH > 62 && rand() < 0.18) {
        const split = courseH * between(0.42, 0.58);
        paths.push(stonePath(x, y, w, split));
        paths.push(stonePath(x, y + split, w, courseH - split));
      } else {
        paths.push(stonePath(x, y, w, courseH));
      }
      x += w;
    }
    y += courseH;
  }
  return paths;
}

/* Wall mask: one big lit rectangle with every stone punched out
   (fill-rule evenodd) so the light pours through the joints, plus the same
   stones repainted at low alpha so a faint wash warms the stone faces too.
   Softly blurred, baked once into a data-URI; never re-rasterized. */
const wallMask = (() => {
  const stones = buildWall().join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${VIEW_W}" height="${VIEW_H}" viewBox="0 0 ${VIEW_W} ${VIEW_H}">` +
    `<filter id="b" x="-2%" y="-2%" width="104%" height="104%"><feGaussianBlur stdDeviation="2.2"/></filter>` +
    `<g filter="url(#b)">` +
    `<path fill="#fff" fill-rule="evenodd" d="M0 0H${VIEW_W}V${VIEW_H}H0Z${stones}"/>` +
    `<path fill="#fff" fill-opacity="0.18" d="${stones}"/>` +
    `</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();

/* Mineral grain, as a small repeating tile (static, painted once). */
const grain = (() => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">` +
    `<filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.47  0 0 0 0 0.42  0.4 0.4 0.4 0 0"/></filter>` +
    `<rect width="320" height="320" filter="url(#g)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();
</script>

<template>
  <div class="stone-wall" aria-hidden="true">
    <div class="stone-wall__wall">
      <div class="sw-grain" :style="{ backgroundImage: grain }" />
      <!-- The light behind the wall, seen through the mortar joints (full)
           and on the stone faces (faint, baked into the mask's alpha). -->
      <div
        class="sw-light sw-light--joints"
        :style="{ maskImage: wallMask, WebkitMaskImage: wallMask }"
      >
        <div class="sw-blob sw-blob--a" />
        <div class="sw-blob sw-blob--b" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.stone-wall {
  --sw-glow-rgb: 186 137 66;
  --sw-joints-a: 0.55;
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
  --sw-grain-a: 0.06;
}

.stone-wall__wall {
  position: absolute;
  inset: 0;
  /* Own compositor layer: without it the masked light repaints into the
     root layer on every animation frame. Static promotion only — never
     move this layer (see the parallax note above). */
  will-change: transform;
}

.sw-grain {
  position: absolute;
  inset: 0;
  background-repeat: repeat;
  background-size: 320px 320px;
  opacity: var(--sw-grain-a);
}

.sw-light {
  position: absolute;
  inset: 0;
}

.sw-light--joints {
  opacity: var(--sw-joints-a);
  mask-repeat: no-repeat;
  mask-size: cover;
  mask-position: top center;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: cover;
  -webkit-mask-position: top center;
}

/* The light wanders behind the wall; the mask stays fixed to the stones.
   Blobs only ever animate transform/opacity, so they live on the compositor. */
.sw-blob {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform, opacity;
  background: radial-gradient(
    closest-side,
    rgb(var(--sw-glow-rgb) / 0.85),
    rgb(var(--sw-glow-rgb) / 0.32) 45%,
    transparent 100%
  );
}

.sw-blob--a {
  width: 60vmax;
  height: 60vmax;
  transform: translate(calc(40vw - 50%), calc(58vh - 50%));
  animation: sw-drift-a 85s ease-in-out infinite;
}

.sw-blob--b {
  width: 45vmax;
  height: 45vmax;
  transform: translate(calc(56vw - 50%), calc(27vh - 50%));
  animation: sw-drift-b 115s ease-in-out infinite;
  animation-delay: -45s;
}

@keyframes sw-drift-a {
  0% {
    transform: translate(calc(15vw - 50%), calc(25vh - 50%));
    opacity: 0.35;
  }
  20% {
    opacity: 0.9;
  }
  30% {
    transform: translate(calc(40vw - 50%), calc(58vh - 50%));
  }
  55% {
    transform: translate(calc(77vw - 50%), calc(39vh - 50%));
    opacity: 0.75;
  }
  70% {
    opacity: 0.25;
  }
  80% {
    transform: translate(calc(52vw - 50%), calc(16vh - 50%));
    opacity: 0.6;
  }
  100% {
    transform: translate(calc(15vw - 50%), calc(25vh - 50%));
    opacity: 0.35;
  }
}

@keyframes sw-drift-b {
  0% {
    transform: translate(calc(84vw - 50%), calc(71vh - 50%));
    opacity: 0.3;
  }
  25% {
    transform: translate(calc(56vw - 50%), calc(27vh - 50%));
    opacity: 0.8;
  }
  50% {
    transform: translate(calc(26vw - 50%), calc(65vh - 50%));
    opacity: 0.5;
  }
  75% {
    transform: translate(calc(66vw - 50%), calc(82vh - 50%));
    opacity: 0.85;
  }
  100% {
    transform: translate(calc(84vw - 50%), calc(71vh - 50%));
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
