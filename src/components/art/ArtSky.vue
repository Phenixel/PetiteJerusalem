<script lang="ts">
/** The moments of the day a sky is drawn for. */
export type SkyMoment = "chaharit" | "shema" | "amida" | "minha" | "arvit" | "slihot";
</script>

<script setup lang="ts">
/**
 * The sky of a moment of prayer, over the walls of Jerusalem, in 120 × 80:
 * the sun rising behind the walls for Cha'harit, climbing for the Chema and
 * the 'Amida, going down for Min'ha; the three stars of Arvit; the deep
 * night and the crescent of the Sli'hot. The walls take the light of the
 * hour: gold stone by day, a dark outline at night, a few lit windows.
 *
 * Flat colors, no gradient, like the other objects of the cards (see
 * docs/design.md, "A highlighted card can carry its object"). The colors
 * belong to the sky, not to the theme: they are the same in every theme.
 */
import { computed } from "vue";

const props = defineProps<{ moment: SkyMoment }>();

interface Sky {
  sky: string;
  /** The band of light along the horizon, at dawn and in the evening. */
  band?: string;
  sun?: { x: number; y: number; r: number; color: string };
  stars?: [number, number][];
  /** Small stars, many of them: the middle of the night. */
  small?: boolean;
  moon?: boolean;
  wall: string;
  /** The lit face of the tower and the dome. */
  lit: string;
  windows?: boolean;
}

const SKIES: Record<SkyMoment, Sky> = {
  chaharit: {
    sky: "#f6dcc2",
    band: "#f5b77a",
    sun: { x: 60, y: 58, r: 11, color: "#ef8a2e" },
    wall: "#7d5236",
    lit: "#a06a42",
  },
  shema: {
    sky: "#cfe4f0",
    sun: { x: 88, y: 22, r: 8, color: "#f4b636" },
    wall: "#c9ab7c",
    lit: "#dcc196",
  },
  amida: {
    sky: "#bcdbee",
    sun: { x: 64, y: 14, r: 8, color: "#f6c242" },
    wall: "#d2b585",
    lit: "#e3cba1",
  },
  minha: {
    sky: "#f4d9a6",
    band: "#efbd78",
    sun: { x: 28, y: 40, r: 9, color: "#e97c26" },
    wall: "#9a6a3f",
    lit: "#b8844f",
  },
  arvit: {
    sky: "#26345a",
    band: "#33436d",
    stars: [
      [30, 20],
      [62, 12],
      [92, 26],
    ],
    wall: "#141b2e",
    lit: "#1d2640",
    windows: true,
  },
  slihot: {
    sky: "#141b30",
    moon: true,
    stars: [
      [18, 14],
      [44, 26],
      [70, 10],
      [98, 28],
      [108, 40],
      [84, 36],
    ],
    small: true,
    wall: "#0a0e19",
    lit: "#10162a",
    windows: true,
  },
};

const sky = computed(() => SKIES[props.moment]);

/** A four-pointed star, centered on (x, y). */
function star(x: number, y: number, size: number): string {
  const k = size * 0.28;
  return `M${x} ${y - size}L${x + k} ${y - k}L${x + size} ${y}L${x + k} ${y + k}L${x} ${y + size}L${x - k} ${y + k}L${x - size} ${y}L${x - k} ${y - k}Z`;
}

/** The merlons along the wall, and on the tower. */
const MERLONS = Array.from({ length: 18 }, (_, i) => i * 7);
const TOWER_MERLONS = [18, 23, 28];
</script>

<template>
  <svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <rect width="120" height="80" :fill="sky.sky" />
    <rect v-if="sky.band" y="44" width="120" height="14" :fill="sky.band" />

    <template v-if="sky.sun">
      <circle
        :cx="sky.sun.x"
        :cy="sky.sun.y"
        :r="sky.sun.r + 5"
        :fill="sky.sun.color"
        opacity="0.18"
      />
      <circle :cx="sky.sun.x" :cy="sky.sun.y" :r="sky.sun.r" :fill="sky.sun.color" />
    </template>
    <template v-if="sky.moon">
      <circle cx="96" cy="16" r="7" fill="#efe6cc" />
      <circle cx="99.5" cy="13.5" r="6.2" :fill="sky.sky" />
    </template>
    <path
      v-for="([x, y], i) in sky.stars ?? []"
      :key="i"
      :d="star(x, y, sky.small ? 2.4 : 3.6)"
      fill="#f6e9c6"
    />

    <!-- The walls: the rampart and its merlons, a tower, a dome. -->
    <rect y="56" width="120" height="24" :fill="sky.wall" />
    <rect v-for="x in MERLONS" :key="x" :x="x" y="52" width="4" height="4" :fill="sky.wall" />
    <rect x="18" y="42" width="15" height="16" :fill="sky.wall" />
    <rect v-for="x in TOWER_MERLONS" :key="x" :x="x" y="38" width="3" height="4" :fill="sky.wall" />
    <rect x="18" y="42" width="5" height="16" :fill="sky.lit" />
    <rect x="78" y="46" width="22" height="12" :fill="sky.wall" />
    <path d="M78 47A11 11 0 0 1 100 47Z" :fill="sky.lit" />
    <rect x="88.4" y="31" width="1.2" height="6" :fill="sky.lit" />
    <path d="M52 80V66A6 6 0 0 1 64 66V80Z" :fill="sky.lit" opacity="0.55" />
    <template v-if="sky.windows">
      <rect x="24" y="47" width="2.4" height="3.6" fill="#f6c86a" />
      <rect x="92" y="51" width="2.4" height="3.2" fill="#f6c86a" />
      <rect x="60" y="60" width="2.4" height="3.2" fill="#f6c86a" />
    </template>
  </svg>
</template>
