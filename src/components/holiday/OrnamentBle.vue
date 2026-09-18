<script setup lang="ts">
// L'épi de blé de Chavouot, la fête de la moisson : la tige, les grains qui
// montent par paires, l'épillet du sommet, et les barbes et la feuille, à la
// seconde couleur. À l'arrivée, il se pose.
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
      <path d="M32 62V20" />
      <path d="M32 20c-3-3-3-8 0-12 3 4 3 9 0 12z" />
      <path d="M32 28c-5-1-8-4-8-9 5 1 8 4 8 9z" />
      <path d="M32 28c5-1 8-4 8-9-5 1-8 4-8 9z" />
      <path d="M32 36c-5-1-8-4-8-9 5 1 8 4 8 9z" />
      <path d="M32 36c5-1 8-4 8-9-5 1-8 4-8 9z" />
      <path d="M32 44c-5-1-8-4-8-9 5 1 8 4 8 9z" />
      <path d="M32 44c5-1 8-4 8-9-5 1-8 4-8 9z" />
      <path class="accent" d="m28 8-4-4" />
      <path class="accent" d="m36 8 4-4" />
      <path class="accent" d="M32 54c-6 0-10-4-12-10 6 0 10 4 12 10z" />
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
