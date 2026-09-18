<script setup lang="ts">
// La toupie de 'Hanouka : le corps à facettes, sa pointe en bas, son manche
// en haut, et une lettre sur chaque face visible. Les lettres et les éclats
// du mouvement prennent la seconde couleur. À l'arrivée, elle se pose.
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
      <path d="M29 4h6" />
      <path d="M32 4v10" />
      <path d="M17 14h30v20L32 56 17 34z" />
      <path d="M32 14v42" />
      <path class="accent" d="M23 22v9" />
      <path class="accent" d="M23 31h4" />
      <path class="accent" d="M40 22c2 1 3 3 3 6v3" />
      <path class="accent" d="m8 22-4-3" />
      <path class="accent" d="m8 32-4 1" />
      <path class="accent" d="m56 22 4-3" />
      <path class="accent" d="m56 32 4 1" />
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
