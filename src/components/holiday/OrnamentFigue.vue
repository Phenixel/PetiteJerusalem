<script setup lang="ts">
// La figue de Tou Bichvat : le fruit en goutte, sa queue, et ses nervures,
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
      <path d="M32 12c-3 6-11 9-13 19-2 11 5 21 13 21s15-10 13-21c-2-10-10-13-13-19z" />
      <path d="M32 12c0-4 1-7 3-9" />
      <path class="accent" d="M32 24v22" />
      <path class="accent" d="M24 34c3 3 5 6 8 12" />
      <path class="accent" d="M40 34c-3 3-5 6-8 12" />
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
