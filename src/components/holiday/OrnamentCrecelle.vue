<script setup lang="ts">
// La crécelle de Pourim : le manche, la boîte qui tourne, la manivelle, et
// le bruit qu'elle fait, à la seconde couleur. À l'arrivée, elle se pose.
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
      <path d="M22 60V40" />
      <path d="M18 40h24V22H18z" />
      <path d="M24 28h12" />
      <path d="M24 34h12" />
      <path d="M42 31h10" />
      <path d="M52 22v18" />
      <path class="accent" d="m58 16 3-3" />
      <path class="accent" d="M60 31h4" />
      <path class="accent" d="m58 46 3 3" />
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
