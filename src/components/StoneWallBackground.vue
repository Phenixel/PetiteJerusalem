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

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { isDegradedRendering, isGecko } from "../composables/useDevicePerf";

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
const wallMaskUri = (() => {
  const stones = buildWall().join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${VIEW_W}" height="${VIEW_H}" viewBox="0 0 ${VIEW_W} ${VIEW_H}">` +
    `<filter id="b" x="-2%" y="-2%" width="104%" height="104%"><feGaussianBlur stdDeviation="2.2"/></filter>` +
    `<g filter="url(#b)">` +
    `<path fill="#fff" fill-rule="evenodd" d="M0 0H${VIEW_W}V${VIEW_H}H0Z${stones}"/>` +
    `<path fill="#fff" fill-opacity="0.18" d="${stones}"/>` +
    `</g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
})();
const wallMask = `url("${wallMaskUri}")`;

/* Mineral grain, as a small repeating tile (static, painted once). */
const grainUri = (() => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">` +
    `<filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.47  0 0 0 0 0.42  0.4 0.4 0.4 0 0"/></filter>` +
    `<rect width="320" height="320" filter="url(#g)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
})();
const grain = `url("${grainUri}")`;

/* ------------------------------------------------------------------------
   Mode raster : le mur peint UNE FOIS dans un <canvas>, puis plus rien.

   Firefox re-rasterise le mask SVG (1600×1100, flouté) et le grain
   (feTurbulence) à chaque tick de rendu tant que quelque chose bouge derrière
   — halos, transitions de hover, scroll (bug Mozilla 1860510). Même figée, la
   version CSS/SVG reste donc coûteuse chez Gecko. Un canvas est de simples
   pixels : composé une fois, retenu tel quel par le compositeur.

   - Gecko : toujours en raster (décision synchrone, aucun frame lent).
   - Autres navigateurs : raster seulement si le rendu est dégradé (peu de
     cœurs/RAM, renderer logiciel, FPS mesuré mauvais — useDevicePerf).
   Chrome/Safari sur machine saine gardent la version animée d'origine.
   ------------------------------------------------------------------------ */
const useRaster = computed(() => isGecko || isDegradedRendering.value);
const rasterFailed = ref(false);
const rootEl = ref<HTMLElement | null>(null);
const rasterCanvas = ref<HTMLCanvasElement | null>(null);

let maskImagePromise: Promise<HTMLImageElement> | null = null;
let grainImagePromise: Promise<HTMLImageElement> | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Un seul rendu par « génération » : les redraws obsolètes (resize/thème en
    rafale) sont abandonnés au lieu de se peindre les uns sur les autres. */
let drawGeneration = 0;

async function drawRasterWall(): Promise<void> {
  const canvas = rasterCanvas.value;
  const root = rootEl.value;
  if (!canvas || !root) return;
  const generation = ++drawGeneration;
  try {
    maskImagePromise ??= loadImage(wallMaskUri);
    grainImagePromise ??= loadImage(grainUri);
    const [maskImg, grainImg] = await Promise.all([maskImagePromise, grainImagePromise]);
    if (generation !== drawGeneration || !rasterCanvas.value) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    // Fond doux : la demi-résolution suffit largement et divise la mémoire par 4.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    // Teinte et opacités du thème courant (variables posées sur .stone-wall).
    const styles = getComputedStyle(root);
    const glow = (styles.getPropertyValue("--sw-glow-rgb").trim() || "186 137 66")
      .split(/\s+/)
      .map(Number);
    const jointsAlpha = parseFloat(styles.getPropertyValue("--sw-joints-a")) || 0.55;
    const grainAlpha = parseFloat(styles.getPropertyValue("--sw-grain-a")) || 0.05;

    // Couche lumière : les deux halos à leur position de repos (mêmes valeurs
    // que l'état statique CSS : opacité 0.4), masqués par les joints du mur.
    const light = document.createElement("canvas");
    light.width = Math.round(w * dpr);
    light.height = Math.round(h * dpr);
    const lctx = light.getContext("2d");
    const ctx = canvas.getContext("2d");
    if (!lctx || !ctx) throw new Error("canvas 2d indisponible");
    lctx.scale(dpr, dpr);

    const vmax = Math.max(w, h) / 100;
    const blob = (cx: number, cy: number, radius: number) => {
      const g = lctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      const [r, gr, b] = glow;
      g.addColorStop(0, `rgba(${r}, ${gr}, ${b}, ${0.85 * 0.4})`);
      g.addColorStop(0.45, `rgba(${r}, ${gr}, ${b}, ${0.32 * 0.4})`);
      g.addColorStop(1, `rgba(${r}, ${gr}, ${b}, 0)`);
      lctx.fillStyle = g;
      lctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    };
    blob((40 * w) / 100, (58 * h) / 100, 30 * vmax); // sw-blob--a (60vmax)
    blob((56 * w) / 100, (27 * h) / 100, 22.5 * vmax); // sw-blob--b (45vmax)

    // Équivalent de mask-size: cover / mask-position: top center.
    const scale = Math.max(w / VIEW_W, h / VIEW_H);
    const dw = VIEW_W * scale;
    lctx.globalCompositeOperation = "destination-in";
    lctx.drawImage(maskImg, (w - dw) / 2, 0, dw, VIEW_H * scale);

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = jointsAlpha;
    ctx.drawImage(light, 0, 0, w, h);
    const pattern = ctx.createPattern(grainImg, "repeat");
    if (pattern) {
      ctx.globalAlpha = grainAlpha;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalAlpha = 1;
  } catch {
    // Peinture impossible (canvas bloqué, image refusée…) : on retombe sur la
    // version DOM figée — moins bien sous Gecko, mais jamais de mur absent.
    rasterFailed.value = true;
  }
}

let redrawTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleRedraw() {
  clearTimeout(redrawTimer);
  redrawTimer = setTimeout(() => void drawRasterWall(), 250);
}

// Le thème (clair/sombre, couleur d'ambiance) vit dans des classes sur <html> :
// on repeint quand elles changent. Une repeinte = quelques millisecondes, une
// fois — sans commune mesure avec un mask animé en continu.
let themeObserver: MutationObserver | null = null;

onMounted(() => {
  if (!useRaster.value) return;
  void drawRasterWall();
  window.addEventListener("resize", scheduleRedraw);
  themeObserver = new MutationObserver(scheduleRedraw);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
});

// Rendu dégradé détecté APRÈS le montage (sonde FPS) : on bascule en raster.
watch(useRaster, (raster) => {
  if (!raster) return;
  void nextTick().then(() => drawRasterWall());
  window.addEventListener("resize", scheduleRedraw);
  if (!themeObserver) {
    themeObserver = new MutationObserver(scheduleRedraw);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }
});

onUnmounted(() => {
  clearTimeout(redrawTimer);
  window.removeEventListener("resize", scheduleRedraw);
  themeObserver?.disconnect();
  themeObserver = null;
});
</script>

<template>
  <!-- Deux rendus :
       - <canvas> : mur peint une fois (Gecko toujours, autres navigateurs en
         rendu dégradé) — de simples pixels, rien à re-rasteriser.
       - version DOM/SVG animée : Chrome/Safari sur machine saine ; figée
         (--static) si le raster a échoué sur une machine dégradée. -->
  <div ref="rootEl" class="stone-wall" aria-hidden="true">
    <canvas v-if="useRaster && !rasterFailed" ref="rasterCanvas" class="sw-raster"></canvas>
    <div
      v-else
      class="stone-wall__wall"
      :class="{ 'stone-wall--static': isDegradedRendering }"
    >
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

/* Rendu raster : de simples pixels plein écran, jamais repeints par le site. */
.sw-raster {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
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

.stone-wall--static .sw-blob--a,
.stone-wall--static .sw-blob--b {
  animation: none;
  opacity: 0.4;
}
</style>
