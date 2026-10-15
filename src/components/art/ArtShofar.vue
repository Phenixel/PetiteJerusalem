<script lang="ts">
/**
 * La forme du chofar, calculée une fois : une corne qui suit une courbe de
 * Bézier, de l'embouchure (en bas à gauche, fine) au pavillon (en haut,
 * large et ouvert vers l'avant). La largeur grandit le long de la courbe ;
 * les deux bords sont la courbe décalée de part et d'autre.
 */
type Point = [number, number];

const P0: Point = [16, 122];
const P1: Point = [60, 130];
const P2: Point = [94, 82];
const P3: Point = [70, 20];
const STEPS = 48;

function bezier(t: number): Point {
  const u = 1 - t;
  return [
    u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0],
    u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1],
  ];
}

function tangent(t: number): Point {
  const u = 1 - t;
  const dx =
    3 * u * u * (P1[0] - P0[0]) + 6 * u * t * (P2[0] - P1[0]) + 3 * t * t * (P3[0] - P2[0]);
  const dy =
    3 * u * u * (P1[1] - P0[1]) + 6 * u * t * (P2[1] - P1[1]) + 3 * t * t * (P3[1] - P2[1]);
  const length = Math.hypot(dx, dy);
  return [dx / length, dy / length];
}

/** La demi-largeur de la corne : 2 à l'embouchure, 17 au pavillon. */
const halfWidth = (t: number) => 2 + 15 * Math.pow(t, 1.4);

const outer: Point[] = [];
const inner: Point[] = [];
const middle: Point[] = [];
for (let i = 0; i <= STEPS; i++) {
  const t = i / STEPS;
  const [x, y] = bezier(t);
  const [dx, dy] = tangent(t);
  const w = halfWidth(t);
  // La normale (-dy, dx) pointe vers l'extérieur de la courbe, qui tourne à
  // gauche en montant.
  outer.push([x - dy * w, y + dx * w]);
  inner.push([x + dy * w, y - dx * w]);
  middle.push([x, y]);
}

const fmt = (n: number) => n.toFixed(2);
const line = (points: Point[]) => points.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join("L");

const HORN = `M${line(outer)}L${line([...inner].reverse())}Z`;

/** Le flanc intérieur de la courbe, dans l'ombre : du bord intérieur au milieu. */
const SHADE = `M${line(inner)}L${line([...middle].reverse())}Z`;

/** Le reflet sur le dos de la courbe, du premier tiers au pavillon. */
const SHINE = `M${line(
  outer.slice(14, STEPS - 2).map(([x, y], i) => {
    const [mx, my] = middle[i + 14];
    return [mx + (x - mx) * 0.62, my + (y - my) * 0.62];
  }),
)}`;

/** Les anneaux de la corne, en travers, d'un bord à l'autre. */
const RINGS = [10, 16, 22, 28, 34, 40].map((i) => {
  const [ax, ay] = outer[i];
  const [bx, by] = inner[i];
  const [dx, dy] = tangent(i / STEPS);
  // Un léger bombé vers le pavillon : l'anneau fait le tour de la corne.
  return `M${fmt(ax)} ${fmt(ay)}Q${fmt((ax + bx) / 2 + dx * 2.4)} ${fmt((ay + by) / 2 + dy * 2.4)} ${fmt(bx)} ${fmt(by)}`;
});

/** L'embouchure, polie et plus sombre. */
const MOUTH = `M${line(outer.slice(0, 5))}L${line(inner.slice(0, 5).reverse())}Z`;

/** Le pavillon : l'ouverture vue de biais, perpendiculaire à la corne. */
const [endX, endY] = middle[STEPS];
const [endDx, endDy] = tangent(1);
const BELL = {
  cx: endX,
  cy: endY,
  rx: halfWidth(1),
  ry: halfWidth(1) * 0.6,
  rotation: (Math.atan2(endDx, -endDy) * 180) / Math.PI,
};
</script>

<script setup lang="ts">
/**
 * Le chofar, dans 100 × 140 : une corne de bélier dont l'embouchure, fine et
 * sombre, est en bas, et qui monte en s'élargissant jusqu'au pavillon, en
 * haut, ouvert vers l'avant et qui dépasse de la carte. Ivoire et miel, ses
 * anneaux en travers, le dedans du pavillon dans l'ombre.
 */
</script>

<template>
  <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
    <path :d="HORN" class="horn" />
    <path :d="SHADE" class="horn-shade" />
    <path :d="SHINE" class="horn-shine" />
    <path v-for="ring in RINGS" :key="ring" :d="ring" class="ring" />
    <path :d="MOUTH" class="mouth" />
    <!-- Le pavillon : le bord de la corne, et le dedans dans l'ombre. -->
    <ellipse
      :cx="BELL.cx"
      :cy="BELL.cy"
      :rx="BELL.rx"
      :ry="BELL.ry"
      :transform="`rotate(${BELL.rotation} ${BELL.cx} ${BELL.cy})`"
      class="bell-rim"
    />
    <ellipse
      :cx="BELL.cx"
      :cy="BELL.cy"
      :rx="BELL.rx - 2.4"
      :ry="BELL.ry - 2"
      :transform="`rotate(${BELL.rotation} ${BELL.cx} ${BELL.cy})`"
      class="bell-inside"
    />
  </svg>
</template>

<style scoped>
/* Les couleurs de l'objet : la corne, du miel à l'ivoire. */
.horn {
  fill: #e6cf9f;
}
.horn-shade {
  fill: #cba86c;
}
.horn-shine {
  fill: none;
  stroke: #f4e7c8;
  stroke-width: 2.4;
  stroke-linecap: round;
}
.ring {
  fill: none;
  stroke: #b38749;
  stroke-width: 1.4;
  stroke-linecap: round;
}
.mouth {
  fill: #74512c;
}
.bell-rim {
  fill: #f1e2bd;
}
.bell-inside {
  fill: #6e4c28;
}
</style>
