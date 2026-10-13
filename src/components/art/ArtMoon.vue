<script lang="ts">
/**
 * La face visible, telle qu'on la voit à l'œil nu, le nord en haut :
 * coordonnées sur le disque, de -1 à 1, x vers la droite et y vers le bas.
 *
 * Les contours des mers sont relevés sur une photo de la pleine lune (le
 * disque flouté pour effacer cratères et rayons, puis seuillé au tiers le
 * plus sombre, et ses bords simplifiés), et non dessinés de mémoire : les
 * mers se rejoignent comme sur la vraie, d'un seul tenant de l'Océan des
 * Tempêtes à la Fécondité, avec les baies claires de Copernic et de Kepler.
 * Chaque contour est lissé (une spline fermée passant par ses points), et
 * rendu en aplat, dans le style des autres objets.
 */
type Point = [number, number];

/** Les mers, d'un seul tenant : l'Océan des Tempêtes, les Pluies, la Sérénité, la Tranquillité, la Fécondité, le Nectar, les Nuées, les Humeurs. */
const MARIA: Point[][] = [
  [
    [-0.34, -0.91],
    [-0.3, -0.9],
    [-0.3, -0.81],
    [-0.28, -0.78],
    [-0.2, -0.79],
    [-0.11, -0.83],
    [0.05, -0.82],
    [0.19, -0.75],
    [0.19, -0.61],
    [0.09, -0.54],
    [0.1, -0.44],
    [0.06, -0.37],
    [0.11, -0.33],
    [0.26, -0.36],
    [0.32, -0.52],
    [0.38, -0.56],
    [0.45, -0.56],
    [0.57, -0.51],
    [0.61, -0.39],
    [0.61, -0.26],
    [0.71, -0.18],
    [0.76, -0.05],
    [0.76, 0.05],
    [0.85, 0.12],
    [0.89, 0.19],
    [0.88, 0.24],
    [0.78, 0.34],
    [0.74, 0.35],
    [0.71, 0.31],
    [0.7, 0.26],
    [0.71, 0.11],
    [0.68, 0.09],
    [0.6, 0.05],
    [0.52, 0.1],
    [0.43, 0.0],
    [0.4, -0.09],
    [0.41, -0.18],
    [0.43, -0.22],
    [0.41, -0.27],
    [0.27, -0.18],
    [0.24, -0.18],
    [0.14, -0.25],
    [0.09, -0.25],
    [0.05, -0.2],
    [0.07, -0.14],
    [0.07, -0.1],
    [0.01, -0.12],
    [-0.15, -0.1],
    [-0.2, -0.15],
    [-0.2, -0.24],
    [-0.18, -0.26],
    [-0.06, -0.28],
    [-0.03, -0.32],
    [-0.02, -0.38],
    [-0.07, -0.42],
    [-0.23, -0.46],
    [-0.31, -0.46],
    [-0.34, -0.41],
    [-0.33, -0.26],
    [-0.23, -0.14],
    [-0.26, -0.01],
    [-0.21, 0.02],
    [-0.15, -0.04],
    [-0.11, 0.03],
    [-0.1, 0.14],
    [-0.15, 0.22],
    [-0.15, 0.3],
    [-0.21, 0.33],
    [-0.41, 0.3],
    [-0.46, 0.36],
    [-0.49, 0.36],
    [-0.52, 0.28],
    [-0.6, 0.3],
    [-0.67, 0.24],
    [-0.68, 0.15],
    [-0.61, 0.04],
    [-0.63, 0.02],
    [-0.75, 0.03],
    [-0.86, -0.17],
    [-0.82, -0.33],
    [-0.83, -0.49],
    [-0.75, -0.61],
    [-0.61, -0.75],
  ],
];

/** Leurs parties les plus sombres. */
const MARIA_DEEP: Point[][] = [
  [
    [-0.45, -0.86],
    [-0.4, -0.84],
    [-0.39, -0.76],
    [-0.49, -0.71],
    [-0.56, -0.64],
    [-0.55, -0.58],
    [-0.48, -0.53],
    [-0.49, -0.47],
    [-0.56, -0.36],
    [-0.56, -0.32],
    [-0.5, -0.25],
    [-0.46, -0.24],
    [-0.43, -0.2],
    [-0.45, -0.13],
    [-0.48, -0.09],
    [-0.47, -0.03],
    [-0.41, -0.0],
    [-0.36, -0.05],
    [-0.32, -0.05],
    [-0.3, 0.02],
    [-0.38, 0.03],
    [-0.43, 0.04],
    [-0.46, 0.08],
    [-0.52, 0.08],
    [-0.57, -0.04],
    [-0.7, -0.05],
    [-0.77, -0.09],
    [-0.81, -0.2],
    [-0.79, -0.51],
    [-0.77, -0.59],
    [-0.61, -0.75],
  ],
  [
    [-0.13, -0.79],
    [0.01, -0.78],
    [0.03, -0.76],
    [0.03, -0.64],
    [-0.07, -0.55],
    [-0.22, -0.56],
    [-0.25, -0.58],
    [-0.3, -0.56],
    [-0.35, -0.51],
    [-0.39, -0.5],
    [-0.41, -0.52],
    [-0.4, -0.6],
    [-0.36, -0.64],
    [-0.28, -0.66],
    [-0.24, -0.72],
    [-0.19, -0.74],
  ],
  [
    [0.55, -0.38],
    [0.57, -0.37],
    [0.56, -0.25],
    [0.58, -0.21],
    [0.67, -0.15],
    [0.71, -0.09],
    [0.7, -0.0],
    [0.61, 0.0],
    [0.52, 0.03],
    [0.47, -0.01],
    [0.45, -0.07],
    [0.45, -0.17],
    [0.51, -0.23],
    [0.49, -0.32],
  ],
  [
    [-0.59, 0.1],
    [-0.53, 0.1],
    [-0.53, 0.22],
    [-0.56, 0.25],
    [-0.61, 0.25],
    [-0.65, 0.19],
    [-0.64, 0.13],
  ],
  [
    [0.4, -0.49],
    [0.44, -0.47],
    [0.44, -0.36],
    [0.42, -0.34],
    [0.4, -0.34],
    [0.33, -0.37],
    [0.34, -0.44],
  ],
  [
    [-0.25, 0.15],
    [-0.18, 0.16],
    [-0.2, 0.27],
    [-0.22, 0.3],
    [-0.28, 0.3],
    [-0.31, 0.27],
    [-0.31, 0.25],
  ],
  [
    [0.78, 0.15],
    [0.83, 0.17],
    [0.83, 0.2],
    [0.8, 0.23],
    [0.76, 0.23],
  ],
  [
    [-0.02, -0.24],
    [0.0, -0.23],
    [0.0, -0.2],
    [-0.02, -0.17],
    [-0.05, -0.18],
    [-0.05, -0.21],
  ],
];

/** Les îlots de hautes terres au milieu des mers. */
const HIGHLAND_ISLANDS: Point[][] = [
  [
    [-0.48, -0.39],
    [-0.44, -0.37],
    [-0.44, -0.34],
    [-0.46, -0.32],
    [-0.5, -0.33],
    [-0.5, -0.37],
  ],
];

/** La mer des Crises, seule près du bord est : un ovale vu de biais. */
const CRISIUM = { x: 0.9, y: -0.08, rx: 0.07, ry: 0.13 };

/** Les cratères qu'on reconnaît, clairs ou sombres, et ceux des hautes terres. */
const CRATERS: {
  name: string;
  x: number;
  y: number;
  r: number;
  tone: "bright" | "deep" | "pit";
}[] = [
  { name: "Tycho", x: -0.25, y: 0.56, r: 0.04, tone: "bright" },
  { name: "Copernic", x: -0.21, y: -0.33, r: 0.035, tone: "bright" },
  { name: "Aristarque", x: -0.5, y: -0.65, r: 0.024, tone: "bright" },
  { name: "Kepler", x: -0.47, y: -0.36, r: 0.02, tone: "bright" },
  { name: "Proclus", x: 0.8, y: -0.13, r: 0.018, tone: "bright" },
  { name: "Stevinus", x: 0.56, y: 0.65, r: 0.018, tone: "bright" },
  { name: "Censorinus", x: 0.3, y: 0.18, r: 0.014, tone: "bright" },
  { name: "Platon", x: 0.16, y: -0.83, r: 0.028, tone: "deep" },
  { name: "Grimaldi", x: -0.89, y: -0.19, r: 0.035, tone: "deep" },
  // Les hautes terres du sud, criblées : de petits cratères à peine plus
  // sombres que la plaine.
  { name: "Clavius", x: -0.2, y: 0.84, r: 0.036, tone: "pit" },
  { name: "Maginus", x: 0.02, y: 0.82, r: 0.024, tone: "pit" },
  { name: "Walter", x: 0.06, y: 0.55, r: 0.022, tone: "pit" },
  { name: "Maurolycus", x: 0.24, y: 0.66, r: 0.024, tone: "pit" },
  { name: "Stöfler", x: 0.12, y: 0.72, r: 0.022, tone: "pit" },
  { name: "Janssen", x: 0.44, y: 0.78, r: 0.026, tone: "pit" },
  { name: "Ptolémée", x: 0.02, y: 0.3, r: 0.028, tone: "pit" },
  { name: "Schickard", x: -0.62, y: 0.68, r: 0.028, tone: "pit" },
];

/** Les rayons de Tycho, fins et pâles, qui partent du cratère dans tous les sens. */
const RAYS: Point[] = [
  [0.08, 0.26],
  [-0.18, 0.18],
  [-0.52, 0.34],
  [-0.66, 0.56],
  [-0.48, 0.78],
  [-0.27, 0.86],
  [0.04, 0.8],
  [0.22, 0.56],
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

const MARIA_PATHS = MARIA.map(blob);
const DEEP_PATHS = MARIA_DEEP.map(blob);
const ISLAND_PATHS = HIGHLAND_ISLANDS.map(blob);
const [CRISIUM_X, CRISIUM_Y] = at([CRISIUM.x, CRISIUM.y]);
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
 * aux gris de la vraie, les hautes terres claires, les mers plus sombres et
 * leurs fonds plus sombres encore, les cratères clairs (Tycho et ses rayons,
 * Copernic, Kepler, Aristarque) ou sombres (Platon, Grimaldi). La part éclairée a le limbe d'un côté et le
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
      <path v-for="(d, i) in MARIA_PATHS" :key="`m${i}`" :d="d" class="moon-mare" />
      <ellipse
        :cx="CRISIUM_X"
        :cy="CRISIUM_Y"
        :rx="CRISIUM.rx * R"
        :ry="CRISIUM.ry * R"
        class="moon-mare-deep"
      />
      <path v-for="(d, i) in DEEP_PATHS" :key="`d${i}`" :d="d" class="moon-mare-deep" />
      <path v-for="(d, i) in ISLAND_PATHS" :key="`i${i}`" :d="d" class="moon-highland" />
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
  stroke-width: 0.45;
  stroke-linecap: round;
  opacity: 0.4;
}
</style>
