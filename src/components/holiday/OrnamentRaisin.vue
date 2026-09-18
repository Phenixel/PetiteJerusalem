<script setup lang="ts">
// La grappe de Tou Bichvat : six grains, la tige, et la feuille et la vrille
// à la seconde couleur. À l'arrivée, elle se pose.
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
      <circle cx="22" cy="30" r="5.5" />
      <circle cx="32" cy="30" r="5.5" />
      <circle cx="42" cy="30" r="5.5" />
      <circle cx="27" cy="39.5" r="5.5" />
      <circle cx="37" cy="39.5" r="5.5" />
      <circle cx="32" cy="49" r="5.5" />
      <path d="M32 24V12" />
      <path class="accent" d="M32 12c3-7 10-9 16-7-2 6-8 10-16 7z" />
      <path class="accent" d="M32 12c-3-2-5-5-4-8" />
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
