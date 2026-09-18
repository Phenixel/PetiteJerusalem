<script setup lang="ts">
// La 'hanoukkia : huit lumières sur une même traverse, le chamach au milieu,
// plus haut, et le pied. Les flammes prennent la seconde couleur. À
// l'arrivée, elle se pose.
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
      <path d="M22 58h20" />
      <path d="M32 58V30" />
      <path d="M10 30h44" />
      <path d="M12 30V20" />
      <path d="M17 30V20" />
      <path d="M22 30V20" />
      <path d="M27 30V20" />
      <path d="M37 30V20" />
      <path d="M42 30V20" />
      <path d="M47 30V20" />
      <path d="M52 30V20" />
      <path d="M32 30V13" />
      <path class="accent" d="M12 17c-1.5-2-1-4 0-5.5 1 1.5 1.5 3.5 0 5.5z" />
      <path class="accent" d="M17 17c-1.5-2-1-4 0-5.5 1 1.5 1.5 3.5 0 5.5z" />
      <path class="accent" d="M22 17c-1.5-2-1-4 0-5.5 1 1.5 1.5 3.5 0 5.5z" />
      <path class="accent" d="M27 17c-1.5-2-1-4 0-5.5 1 1.5 1.5 3.5 0 5.5z" />
      <path class="accent" d="M37 17c-1.5-2-1-4 0-5.5 1 1.5 1.5 3.5 0 5.5z" />
      <path class="accent" d="M42 17c-1.5-2-1-4 0-5.5 1 1.5 1.5 3.5 0 5.5z" />
      <path class="accent" d="M47 17c-1.5-2-1-4 0-5.5 1 1.5 1.5 3.5 0 5.5z" />
      <path class="accent" d="M52 17c-1.5-2-1-4 0-5.5 1 1.5 1.5 3.5 0 5.5z" />
      <path class="accent" d="M32 10c-1.5-2-1-4.5 0-6 1 1.5 1.5 4 0 6z" />
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
