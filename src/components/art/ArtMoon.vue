<script setup lang="ts">
/**
 * La lune, à sa phase : un disque de rayon 48 au centre d'un carré de 100. La
 * part éclairée a le limbe d'un côté et le terminateur (une demi-ellipse) de
 * l'autre ; la part sombre est la lumière cendrée, un voile à peine plus clair
 * que le fond. Les mers et les cratères de la face visible, à grands traits,
 * ne se voient que sur la part éclairée.
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
  const r = 48;
  const rx = Math.abs(1 - 2 * fraction) * r;
  // Croissante, la lune s'éclaire par la droite (vue de l'hémisphère nord) ;
  // décroissante, par la gauche. Le terminateur bombe vers le côté sombre
  // passé le premier quartier.
  const limb = waxing ? 1 : 0;
  const bulge = fraction > 0.5 === waxing ? 1 : 0;
  return `M50 2A${r} ${r} 0 0 ${limb} 50 98A${rx.toFixed(2)} ${r} 0 0 ${bulge} 50 2Z`;
});

/**
 * Les mers : des ellipses qui se chevauchent et dessinent ensemble le réseau
 * sombre qu'on reconnaît à l'œil nu, l'Océan des Tempêtes à l'ouest, les
 * Pluies au nord, la Sérénité et la Tranquillité au centre, les Crises au
 * bord est.
 */
const MARIA = [
  { cx: 48, cy: 17, rx: 17, ry: 3, rot: -4 }, // Mer du Froid
  { cx: 36, cy: 31, rx: 12, ry: 9.5, rot: -10 }, // Mer des Pluies
  { cx: 21, cy: 45, rx: 9, ry: 13, rot: 8 }, // Océan des Tempêtes
  { cx: 25, cy: 62, rx: 8, ry: 9, rot: 0 },
  { cx: 41, cy: 64, rx: 9, ry: 5.5, rot: -8 }, // Mer des Nuées
  { cx: 58, cy: 32, rx: 7, ry: 6.5, rot: 0 }, // Mer de la Sérénité
  { cx: 63, cy: 46, rx: 9, ry: 6.5, rot: 15 }, // Mer de la Tranquillité
  { cx: 56, cy: 52, rx: 5, ry: 4, rot: 0 },
  { cx: 75, cy: 59, rx: 4.5, ry: 7.5, rot: 12 }, // Mer de la Fécondité
  { cx: 65, cy: 63, rx: 3.5, ry: 3.5, rot: 0 }, // Mer du Nectar
  { cx: 83, cy: 37, rx: 5, ry: 4, rot: 0 }, // Mer des Crises
];

/** Quelques cratères, plus clairs que la plaine : Tycho, Copernic, Kepler... */
const CRATERS = [
  { cx: 46, cy: 82, r: 2.4 },
  { cx: 34, cy: 47, r: 1.9 },
  { cx: 23, cy: 46, r: 1.2 },
  { cx: 57, cy: 76, r: 1.4 },
  { cx: 71, cy: 25, r: 1.1 },
  { cx: 87, cy: 53, r: 1 },
];
</script>

<template>
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath :id="`${id}-lit`">
        <path :d="lit" />
      </clipPath>
    </defs>
    <circle cx="50" cy="50" r="48" class="moon-dark" />
    <path :d="lit" class="moon-lit" />
    <g :clip-path="`url(#${id}-lit)`">
      <ellipse
        v-for="(mare, i) in MARIA"
        :key="i"
        :cx="mare.cx"
        :cy="mare.cy"
        :rx="mare.rx"
        :ry="mare.ry"
        :transform="`rotate(${mare.rot} ${mare.cx} ${mare.cy})`"
        class="moon-mare"
      />
      <circle
        v-for="(crater, i) in CRATERS"
        :key="`c${i}`"
        :cx="crater.cx"
        :cy="crater.cy"
        :r="crater.r"
        class="moon-crater"
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
.moon-lit {
  fill: var(--moon-lit);
}
.moon-mare {
  fill: var(--moon-mare);
}
.moon-crater {
  fill: var(--moon-crater);
}
</style>
