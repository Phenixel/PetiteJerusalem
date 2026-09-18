<script setup lang="ts">
// Le verre de vin de Pessah : la coupe, son pied, et le vin qu'elle porte, à
// la seconde couleur. À l'arrivée, il se pose.
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
      <path d="M19 6h26l-1 18c-1 8-6 13-12 13S21 32 20 24z" />
      <path d="M32 37v14" />
      <path d="M22 52h20" />
      <path class="accent" d="M21 18h22" />
      <path class="accent" d="M23 24c1 6 5 10 9 10s8-4 9-10" />
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
