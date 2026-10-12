<script lang="ts">
/**
 * La face visible, telle qu'on la voit à l'œil nu depuis l'hémisphère nord,
 * le nord en haut : coordonnées sur le disque, de -1 à 1, x vers la droite et
 * y vers le bas. Chaque mer est un contour lissé (une spline fermée passant
 * par ses points), à la place approximative qu'elle occupe sur les photos.
 */
type Point = [number, number];

/**
 * Un contour presque rond, de rayon `r`, un peu irrégulier : `wobble` donne,
 * point par point, l'écart au cercle (huit points, en partant de l'est).
 */
function round(cx: number, cy: number, r: number, wobble: number[]): Point[] {
  return wobble.map((w, i) => {
    const angle = (i / wobble.length) * 2 * Math.PI;
    return [cx + Math.cos(angle) * r * (1 + w), cy + Math.sin(angle) * r * (1 + w)];
  });
}

/**
 * Les mers se touchent, comme sur la vraie : au nord-ouest, les Pluies
 * s'ouvrent sur l'Océan des Tempêtes, qui descend jusqu'aux Nuées et aux
 * Humeurs ; au centre, la Sérénité, la Tranquillité, puis la Fécondité et le
 * Nectar ; la mer des Crises seule, près du bord est ; la mer du Froid, une
 * bande en travers du nord. Le centre du disque et tout le sud sont des
 * hautes terres, claires, où brille Tycho.
 */
const MARIA: { name: string; tone: "mare" | "mare-deep"; points: Point[] }[] = [
  {
    name: "Océan des Tempêtes",
    tone: "mare",
    points: [
      [-0.5, -0.56],
      [-0.36, -0.3],
      [-0.3, -0.1],
      [-0.31, 0.08],
      [-0.4, 0.22],
      [-0.52, 0.33],
      [-0.66, 0.3],
      [-0.8, 0.12],
      [-0.88, -0.1],
      [-0.84, -0.33],
      [-0.72, -0.5],
    ],
  },
  {
    name: "Mer des Pluies",
    tone: "mare",
    points: round(-0.26, -0.38, 0.26, [0.02, -0.04, 0.03, 0, -0.03, 0.04, 0, -0.02]),
  },
  {
    name: "Mer du Froid",
    tone: "mare",
    points: [
      [-0.6, -0.62],
      [-0.32, -0.71],
      [0, -0.76],
      [0.28, -0.74],
      [0.42, -0.69],
      [0.32, -0.64],
      [0.04, -0.66],
      [-0.26, -0.62],
      [-0.5, -0.56],
    ],
  },
  {
    name: "Mer des Vapeurs",
    tone: "mare",
    points: round(0.02, -0.22, 0.1, [0, 0.1, -0.05, 0.05, 0, -0.08, 0.06, 0]),
  },
  {
    name: "Mer de la Sérénité",
    tone: "mare",
    points: round(0.22, -0.4, 0.17, [0.03, 0, -0.03, 0.02, 0, 0.03, -0.02, 0]),
  },
  {
    name: "Mer de la Tranquillité",
    tone: "mare-deep",
    points: [
      [0.17, -0.2],
      [0.32, -0.27],
      [0.49, -0.22],
      [0.58, -0.09],
      [0.56, 0.05],
      [0.45, 0.1],
      [0.36, 0.08],
      [0.27, 0.11],
      [0.18, 0.02],
      [0.14, -0.1],
    ],
  },
  {
    name: "Mer de la Fécondité",
    tone: "mare",
    points: [
      [0.48, 0.04],
      [0.6, -0.06],
      [0.68, -0.02],
      [0.73, 0.07],
      [0.73, 0.22],
      [0.65, 0.35],
      [0.56, 0.31],
      [0.5, 0.17],
    ],
  },
  {
    name: "Mer du Nectar",
    tone: "mare",
    points: round(0.38, 0.2, 0.1, [0, 0.05, -0.04, 0, 0.04, -0.03, 0, 0.12]),
  },
  {
    name: "Mer des Crises",
    tone: "mare-deep",
    points: round(0.7, -0.28, 0.12, [0.06, -0.08, -0.02, 0.06, 0.06, -0.08, -0.02, 0.06]),
  },
  {
    name: "Mer des Nuées et Mer de la Connaissance",
    tone: "mare",
    points: [
      [-0.42, 0.03],
      [-0.25, 0.03],
      [-0.1, 0.13],
      [-0.02, 0.28],
      [-0.08, 0.42],
      [-0.22, 0.46],
      [-0.35, 0.4],
      [-0.44, 0.26],
    ],
  },
  {
    name: "Mer des Humeurs",
    tone: "mare",
    points: round(-0.52, 0.4, 0.1, [0, 0.05, -0.03, 0.04, 0, -0.04, 0.03, 0]),
  },
];

/** Les cratères qu'on reconnaît, clairs ou sombres, et ceux des hautes terres. */
const CRATERS: {
  name: string;
  x: number;
  y: number;
  r: number;
  tone: "bright" | "deep" | "pit";
}[] = [
  { name: "Tycho", x: -0.12, y: 0.7, r: 0.045, tone: "bright" },
  { name: "Copernic", x: -0.24, y: -0.08, r: 0.04, tone: "bright" },
  { name: "Kepler", x: -0.56, y: -0.04, r: 0.025, tone: "bright" },
  { name: "Aristarque", x: -0.72, y: -0.3, r: 0.028, tone: "bright" },
  { name: "Proclus", x: 0.6, y: -0.17, r: 0.018, tone: "bright" },
  { name: "Langrenus", x: 0.8, y: 0.1, r: 0.03, tone: "bright" },
  { name: "Platon", x: -0.08, y: -0.68, r: 0.04, tone: "deep" },
  { name: "Grimaldi", x: -0.88, y: 0.08, r: 0.04, tone: "deep" },
  // Les hautes terres du sud, criblées : de petits cratères à peine plus
  // sombres que la plaine.
  { name: "Clavius", x: -0.14, y: 0.88, r: 0.055, tone: "pit" },
  { name: "Maginus", x: 0.08, y: 0.84, r: 0.035, tone: "pit" },
  { name: "Ptolémée", x: -0.06, y: 0.12, r: 0.045, tone: "pit" },
  { name: "Albategnius", x: 0.08, y: 0.24, r: 0.035, tone: "pit" },
  { name: "Walter", x: 0.02, y: 0.56, r: 0.03, tone: "pit" },
  { name: "Maurolycus", x: 0.22, y: 0.62, r: 0.035, tone: "pit" },
  { name: "Stöfler", x: 0.12, y: 0.7, r: 0.03, tone: "pit" },
  { name: "Petavius", x: 0.72, y: 0.42, r: 0.035, tone: "pit" },
  { name: "Schickard", x: -0.6, y: 0.62, r: 0.04, tone: "pit" },
  { name: "Longomontanus", x: -0.32, y: 0.78, r: 0.035, tone: "pit" },
  { name: "Janssen", x: 0.46, y: 0.68, r: 0.035, tone: "pit" },
];

/** Les rayons de Tycho, courts et pâles, qui partent du cratère vers le nord. */
const RAYS: Point[] = [
  [-0.1, 0.42],
  [-0.34, 0.44],
  [0.14, 0.46],
  [-0.42, 0.66],
  [0.2, 0.68],
];

const R = 48;
const at = ([x, y]: Point): Point => [50 + x * R, 50 + y * R];
const fmt = (n: number) => n.toFixed(2);

/** Une spline de Catmull-Rom fermée, en courbes de Bézier. */
function blob(points: Point[]): string {
  const p = points.map(at);
  const n = p.length;
  let d = `M${fmt(p[0][0])} ${fmt(p[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n];
    const p1 = p[i];
    const p2 = p[(i + 1) % n];
    const p3 = p[(i + 2) % n];
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return `${d}Z`;
}

const MARIA_PATHS = MARIA.map((mare) => ({ ...mare, d: blob(mare.points) }));
const CRATER_DOTS = CRATERS.map((crater) => {
  const [cx, cy] = at([crater.x, crater.y]);
  return { ...crater, cx, cy, r: crater.r * R };
});
const TYCHO = at([CRATERS[0].x, CRATERS[0].y]);
const RAY_PATHS = RAYS.map((end) => {
  const [x, y] = at(end);
  return `M${fmt(TYCHO[0])} ${fmt(TYCHO[1])}L${fmt(x)} ${fmt(y)}`;
});
</script>

<script setup lang="ts">
/**
 * La lune, à sa phase : un disque de rayon 48 au centre d'un carré de 100,
 * aux gris de la vraie, les hautes terres claires, les mers plus sombres, les
 * cratères clairs (Tycho et ses rayons, Copernic, Kepler, Aristarque) ou
 * sombres (Platon, Grimaldi). La part éclairée a le limbe d'un côté et le
 * terminateur (une demi-ellipse) de l'autre ; la part sombre est la lumière
 * cendrée, un voile à peine plus clair que le fond, et le relief ne se voit
 * que sur la part éclairée.
 */
import { computed, useId } from "vue";

const props = defineProps<{
  /** L'âge de la lune, en jours depuis le molad. */
  age: number;
}>();

const id = useId();
const SYNODIC_MONTH = 29.530589;

const lit = computed(() => {
  const phase = (((props.age / SYNODIC_MONTH) % 1) + 1) % 1;
  const waxing = phase < 0.5;
  const fraction = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const rx = Math.abs(1 - 2 * fraction) * R;
  // Croissante, la lune s'éclaire par la droite (vue de l'hémisphère nord) ;
  // décroissante, par la gauche. Le terminateur bombe vers le côté sombre
  // passé le premier quartier.
  const limb = waxing ? 1 : 0;
  const bulge = fraction > 0.5 === waxing ? 1 : 0;
  return `M50 2A${R} ${R} 0 0 ${limb} 50 98A${rx.toFixed(2)} ${R} 0 0 ${bulge} 50 2Z`;
});
</script>

<template>
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath :id="`${id}-lit`">
        <path :d="lit" />
      </clipPath>
    </defs>
    <circle cx="50" cy="50" r="48" class="moon-dark" />
    <g :clip-path="`url(#${id}-lit)`">
      <circle cx="50" cy="50" r="48" class="moon-highland" />
      <path
        v-for="mare in MARIA_PATHS"
        :key="mare.name"
        :d="mare.d"
        :class="mare.tone === 'mare' ? 'moon-mare' : 'moon-mare-deep'"
      />
      <path v-for="ray in RAY_PATHS" :key="ray" :d="ray" class="moon-ray" />
      <circle
        v-for="crater in CRATER_DOTS"
        :key="crater.name"
        :cx="crater.cx"
        :cy="crater.cy"
        :r="crater.r"
        :class="`moon-${crater.tone}`"
      />
    </g>
  </svg>
</template>

<style scoped>
/* Les couleurs viennent du cadre (CardArt) : elles changent avec la surface
   de la carte, pas avec le thème. */
.moon-dark {
  fill: var(--moon-dark);
}
.moon-highland {
  fill: var(--moon-highland);
}
.moon-mare {
  fill: var(--moon-mare);
}
.moon-mare-deep {
  fill: var(--moon-mare-deep);
}
.moon-bright {
  fill: var(--moon-bright);
}
.moon-pit {
  fill: var(--moon-pit);
}
.moon-deep {
  fill: var(--moon-mare-deep);
}
.moon-ray {
  fill: none;
  stroke: var(--moon-bright);
  stroke-width: 0.7;
  stroke-linecap: round;
  opacity: 0.35;
}
</style>
