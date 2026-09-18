<script setup lang="ts">
// La matsa de Pessah : la galette ronde, piquée de trous, à la seconde
// couleur. À l'arrivée, elle se pose.
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
      <circle cx="32" cy="32" r="22" />
      <path class="accent" d="M26 20h.01" />
      <path class="accent" d="M38 20h.01" />
      <path class="accent" d="M20 28h.01" />
      <path class="accent" d="M32 28h.01" />
      <path class="accent" d="M44 28h.01" />
      <path class="accent" d="M20 36h.01" />
      <path class="accent" d="M32 36h.01" />
      <path class="accent" d="M44 36h.01" />
      <path class="accent" d="M26 44h.01" />
      <path class="accent" d="M38 44h.01" />
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
