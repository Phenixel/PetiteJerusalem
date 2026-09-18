<script setup lang="ts">
// Le masque de Pourim : un loup, ses deux yeux, et les plumes qui le
// coiffent, à la seconde couleur. À l'arrivée, il se pose.
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
      <path
        d="M6 28c8-8 18-9 26-3 8-6 18-5 26 3-2 12-8 20-18 20-4 0-6-3-8-5-2 2-4 5-8 5-10 0-16-8-18-20z"
      />
      <path d="M15 32c2-4 8-4 10 0-2 4-8 4-10 0z" />
      <path d="M39 32c2-4 8-4 10 0-2 4-8 4-10 0z" />
      <path class="accent" d="m32 25-6-18" />
      <path class="accent" d="m32 25 1-20" />
      <path class="accent" d="m32 25 8-16" />
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
