<script setup lang="ts">
/**
 * La 'hanoukkia, dans 100 × 140 : huit branches sur une barre, le chamach au
 * milieu et plus haut, la tige qui descend sous le bord de la carte.
 *
 * Les bougies sont celles des boîtes qu'on achète, de toutes les couleurs,
 * et grandes : à la taille d'une carte, c'est elles qu'on doit voir. On les
 * pose de droite à gauche, une de plus chaque soir ; allumée, la 'hanoukkia
 * s'allume dans l'ordre où on l'allume quand elle se lève (`rising`) : le
 * chamach, puis la bougie du soir, la plus à gauche, et les autres vers la
 * droite.
 */
import { computed } from "vue";

const props = defineProps<{
  /** Le soir de 'Hanouka, de 1 à 8. */
  night: number;
  /** Allumée, ou les bougies posées pour ce soir. */
  lit: boolean;
  /** La carte se lève : les flammes s'allument une à une. */
  rising?: boolean;
}>();

const BRANCHES = [7, 18, 29, 40, 60, 71, 82, 93];
const SHAMASH = 50;
/** Les cires, de gauche à droite : bleu, rouge, jaune, vert, violet, orange, rose, bleu-vert. */
const WAX = [
  "#2f6db5",
  "#cf3a3a",
  "#e9b92b",
  "#3c9a58",
  "#8a4fb3",
  "#ec7a2a",
  "#dc5a8c",
  "#2a9fa5",
];

const night = computed(() => Math.min(8, Math.max(1, Math.round(props.night))));

/**
 * Les bougies du soir, sur les branches de droite. `order` est le rang
 * d'allumage après le chamach : la dernière posée, à gauche, d'abord.
 */
const candles = computed(() =>
  BRANCHES.map((x, i) => ({
    x,
    wax: WAX[i],
    placed: i >= BRANCHES.length - night.value,
    order: i - (BRANCHES.length - night.value) + 1,
  })).filter((candle) => candle.placed),
);

/** Une flamme dont la pointe est en (x, top), haute de 10. */
function flame(x: number, top: number): string {
  return `M${x} ${top}C${x + 3.6} ${top + 4} ${x + 3.2} ${top + 10} ${x} ${top + 10}C${x - 3.2} ${top + 10} ${x - 3.6} ${top + 4} ${x} ${top}Z`;
}
function core(x: number, top: number): string {
  return `M${x} ${top + 4}C${x + 1.7} ${top + 6} ${x + 1.6} ${top + 10} ${x} ${top + 10}C${x - 1.6} ${top + 10} ${x - 1.7} ${top + 6} ${x} ${top + 4}Z`;
}
</script>

<template>
  <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" :class="{ rising }">
    <!-- La tige, son nœud et son pied, l'argent en deux tons. -->
    <rect x="46.5" y="57" width="7" height="83" class="metal" />
    <rect x="51" y="57" width="2.5" height="83" class="metal-shade" />
    <rect x="43.5" y="78" width="13" height="5" rx="2.5" class="metal-light" />
    <path d="M36 140L42 128H58L64 140Z" class="metal" />
    <!-- La barre et ses godets. -->
    <rect x="2" y="52.5" width="96" height="5" rx="2" class="metal" />
    <rect x="2" y="56" width="96" height="1.5" class="metal-shade" />
    <rect
      v-for="x in BRANCHES"
      :key="`g${x}`"
      :x="x - 4.5"
      y="49"
      width="9"
      height="3.5"
      class="metal-light"
    />
    <!-- Le chamach, sur sa colonne, plus haut que les autres. -->
    <rect x="47.5" y="44" width="5" height="9" class="metal" />
    <rect x="45.5" y="40.5" width="9" height="3.5" class="metal-light" />

    <!-- Les bougies : la cire, son flanc dans l'ombre, la mèche. -->
    <rect :x="SHAMASH - 3.2" y="12" width="6.4" height="28.5" class="wax-shamash" />
    <rect :x="SHAMASH + 1.4" y="12" width="1.8" height="28.5" class="wax-shade" />
    <rect :x="SHAMASH - 0.45" y="9.5" width="0.9" height="2.5" class="wick" />
    <g v-for="candle in candles" :key="`b${candle.x}`">
      <rect :x="candle.x - 3.2" y="18" width="6.4" height="31" :fill="candle.wax" />
      <rect :x="candle.x + 1.4" y="18" width="1.8" height="31" class="wax-shade" />
      <rect :x="candle.x - 0.45" y="15.5" width="0.9" height="2.5" class="wick" />
    </g>

    <!-- Les flammes : le chamach d'abord, puis la bougie du soir. -->
    <template v-if="lit">
      <g class="flame" style="--flame-order: 0">
        <path :d="flame(SHAMASH, -0.5)" class="flame-outer" />
        <path :d="core(SHAMASH, -0.5)" class="flame-inner" />
      </g>
      <g
        v-for="candle in candles"
        :key="`f${candle.x}`"
        class="flame"
        :style="{ '--flame-order': candle.order }"
      >
        <path :d="flame(candle.x, 5.5)" class="flame-outer" />
        <path :d="core(candle.x, 5.5)" class="flame-inner" />
      </g>
    </template>
  </svg>
</template>

<style scoped>
/* Les couleurs de l'objet : l'argent, la cire, la flamme. */
.metal {
  fill: #d3d7dd;
}
.metal-light {
  fill: #eceef1;
}
.metal-shade {
  fill: #a9afb8;
}
.wax-shamash {
  fill: #f5efe3;
}
.wax-shade {
  fill: rgb(0 0 0 / 0.16);
}
.wick {
  fill: #4a4038;
}
.flame-outer {
  fill: #f7a21b;
}
.flame-inner {
  fill: #ffe27a;
}

/* La 'hanoukkia s'est levée (voir CardArt) : les flammes s'allument une à
   une, chacune d'un petit élan. */
.rising .flame {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: flame-on 0.4s ease-out both;
  animation-delay: calc(0.9s + var(--flame-order) * 0.22s);
}
@keyframes flame-on {
  0% {
    opacity: 0;
    transform: scale(0.2);
  }
  60% {
    opacity: 1;
    transform: scale(1.15);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .rising .flame {
    animation: none;
  }
}
</style>
