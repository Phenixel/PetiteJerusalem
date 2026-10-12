<script setup lang="ts">
/**
 * La gerbe du 'Omer, dans 100 × 120 : des épis d'orge liés, l'offrande qu'on
 * apportait au Temple le lendemain de Pessa'h et dont on compte les jours.
 * Neuf tiges en éventail, leurs épis barbus, le lien qui les serre.
 */
const STALKS = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((i) => {
  const top = { x: 50 + i * 8, y: 18 + Math.abs(i) * 4 };
  const knot = { x: 50 + i * 1.3, y: 92 };
  const foot = { x: 50 + i * 3, y: 122 };
  const angle = (Math.atan2(top.x - knot.x, knot.y - top.y) * 180) / Math.PI;
  return { i, top, knot, foot, angle };
});
</script>

<template>
  <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
    <!-- Les tiges, du pied aux épis. -->
    <path
      v-for="s in STALKS"
      :key="`t${s.i}`"
      :d="`M${s.foot.x} ${s.foot.y}L${s.knot.x} ${s.knot.y}L${s.top.x} ${s.top.y}`"
      class="stalk"
    />
    <!-- Les épis, leurs grains et leurs barbes. -->
    <g
      v-for="s in STALKS"
      :key="`e${s.i}`"
      :transform="`translate(${s.top.x} ${s.top.y}) rotate(${s.angle})`"
    >
      <path d="M-1.2 -8L-2.5 -21M0 -9L0 -23M1.2 -8L2.5 -21" class="awn" />
      <ellipse cx="0" cy="0" rx="3.6" ry="9.5" class="ear" />
      <path d="M-3 -4L0 -2L3 -4M-3.4 1L0 3L3.4 1M-3 6L0 8L3 6" class="grain" />
    </g>
    <!-- Le lien. -->
    <rect x="40" y="88" width="20" height="8" rx="2" class="band" />
    <path d="M44 88V96M56 88V96" class="band-line" />
  </svg>
</template>

<style scoped>
/* Les couleurs de l'objet : l'orge mûre, le lien de jonc. */
.stalk {
  fill: none;
  stroke: #c39b44;
  stroke-width: 1.8;
  stroke-linecap: round;
}
.ear {
  fill: #dcb65a;
}
.grain {
  fill: none;
  stroke: #b38c33;
  stroke-width: 0.9;
}
.awn {
  fill: none;
  stroke: #d4bb7c;
  stroke-width: 0.6;
}
.band {
  fill: #8c5a2b;
}
.band-line {
  stroke: #6e4520;
  stroke-width: 1;
}
</style>
