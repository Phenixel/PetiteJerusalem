<script setup lang="ts">
// Le beignet de 'Hanouka : la boule, le sucre glace qui la coiffe, et la
// confiture qui perle au sommet, à la seconde couleur. À l'arrivée, il se
// pose.
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
      <circle cx="32" cy="36" r="22" />
      <path d="M12 32c6-5 12-8 20-8s14 3 20 8" />
      <path class="accent" d="M22 28h.01" />
      <path class="accent" d="M32 25h.01" />
      <path class="accent" d="M42 28h.01" />
      <path class="accent" d="M27 20c0-3 2-5 5-5s5 2 5 5-2 4-5 4-5-1-5-4z" />
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
