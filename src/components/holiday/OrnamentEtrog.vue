<script setup lang="ts">
// L'étrog de Souccot : le cédrat, ventru, à la peau grenue, sa queue et sa
// petite feuille en haut, son pitam en bas. Les éclats autour de lui
// prennent la seconde couleur. À l'arrivée, il se pose en grossissant, comme
// sorti de sa boîte.
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
    <g class="fruit">
      <!-- le fruit, plus étroit vers la queue, la peau qui ondule -->
      <path
        d="M48.6 35.0 47.9 37.8 46.9 40.3 46.6 42.9 46.3 45.8 45.0 48.1 43.0 49.5 41.5 51.2 40.1 53.5 38.3 55.0 36.1 55.1 34.0 55.1 32.0 56.0 29.8 56.5 27.8 55.5 26.1 53.8 24.1 52.9 22.0 52.1 20.4 50.2 19.6 47.5 18.6 45.2 17.0 43.1 16.0 40.6 16.2 37.7 16.6 35.0 16.6 32.3 16.8 29.4 18.1 26.9 19.8 24.8 20.9 22.5 21.9 19.8 23.4 17.9 25.4 17.1 27.1 16.2 28.5 14.5 30.2 13.5 32.0 14.0 33.7 14.9 35.4 14.9 37.3 15.0 38.9 16.5 40.1 18.8 41.6 20.5 43.5 21.9 45.0 24.2 45.6 27.1 46.2 29.7 47.6 32.2Z"
      />
      <!-- la queue et sa feuille -->
      <path d="M31 14v-7" />
      <path d="M31 8c2-4 6-4 9-2-2 3-6 4-9 2z" />
      <!-- le pitam -->
      <path d="m30 58 3 4" />
      <!-- la peau grenue -->
      <path d="M25 27h.01" />
      <path d="M37 24h.01" />
      <path d="M40 38h.01" />
      <path d="M27 44h.01" />
      <path d="M34 50h.01" />
      <!-- les éclats -->
      <path class="accent" d="m8 26-4-2" />
      <path class="accent" d="M6 36H2" />
      <path class="accent" d="m57 24 4-2" />
      <path class="accent" d="M58 34h4" />
    </g>
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
.fruit {
  transform-origin: 32px 34px;
  animation: ornament-pose 0.6s ease-out forwards;
}
@keyframes ornament-pose {
  from {
    transform: scale(0.7);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .fruit {
    animation: none;
  }
}
</style>
