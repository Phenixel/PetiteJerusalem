<script setup lang="ts">
// Les tables de la loi de Chavouot : deux tables au sommet arrondi, côte à
// côte, et leurs lignes, à la seconde couleur. À l'arrivée, elles se posent.
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
    <g class="pose">
      <path d="M10 58V24a11 11 0 0 1 22 0v34z" />
      <path d="M32 58V24a11 11 0 0 1 22 0v34" />
      <path class="accent" d="M16 32h10" />
      <path class="accent" d="M16 40h10" />
      <path class="accent" d="M16 48h10" />
      <path class="accent" d="M38 32h10" />
      <path class="accent" d="M38 40h10" />
      <path class="accent" d="M38 48h10" />
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
.pose {
  transform-origin: 32px 32px;
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
  .pose {
    animation: none;
  }
}
</style>
