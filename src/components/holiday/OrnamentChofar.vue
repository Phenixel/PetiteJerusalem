<script setup lang="ts">
// Le chofar de Roch Hachana : la corne de bélier couchée, le pavillon large
// ouvert à gauche, le corps qui descend puis remonte en s'affinant vers la
// pointe, en haut à droite. Les éclats du son, à la pointe, prennent la
// seconde couleur. À l'arrivée, la corne se dessine du pavillon à la pointe,
// comme le souffle qui la traverse.
</script>

<template>
  <svg
    viewBox="0 0 64 64"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="illu"
  >
    <!-- le pavillon, vu de face -->
    <ellipse cx="11" cy="23" rx="5" ry="8.5" />
    <!-- le corps de la corne, du pavillon à la pointe -->
    <path class="draw" d="M11 14.5c13 .5 24 10.5 33 15.5 10 5.5 15-4 17-25" />
    <path class="draw" d="M11 31.5c11 12.5 30 19.5 41 10.5 7-5.5 9-21 10-37" />
    <!-- les éclats du son -->
    <path class="accent" d="m53 5-2-4" />
    <path class="accent" d="m46 9-4-2" />
  </svg>
</template>

<style scoped>
.illu {
  width: 100%;
  height: 100%;
  overflow: visible;
}
.accent {
  stroke: var(--color-secondary);
}
.draw {
  stroke-dasharray: 90;
  stroke-dashoffset: 90;
  animation: ornament-draw 0.9s ease-out forwards;
}
@keyframes ornament-draw {
  to {
    stroke-dashoffset: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .draw {
    animation: none;
    stroke-dashoffset: 0;
  }
}
</style>
