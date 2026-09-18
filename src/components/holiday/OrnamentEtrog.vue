<script setup lang="ts">
// L'étrog de Souccot : le cédrat, plus large en bas qu'en haut, son pitam au
// sommet et sa queue en bas. La peau grenue est suggérée par quelques points,
// et le reflet prend la seconde couleur. À l'arrivée, il se pose en
// grossissant, comme sorti de sa boîte.
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
    <g class="fruit">
      <path d="M32 12c-9 0-14 10-13 21 1 10 6 19 13 19s12-9 13-19c1-11-4-21-13-21z" />
      <!-- le pitam -->
      <path d="M32 12V6" />
      <path d="M29 4h6" />
      <!-- la queue -->
      <path d="M32 52v6" />
      <!-- la peau grenue -->
      <path d="M26 30h.01" />
      <path d="M38 36h.01" />
      <path d="M30 44h.01" />
      <!-- le reflet -->
      <path class="accent" d="M25 26c1-4 3-7 6-9" />
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
.fruit {
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
  .fruit {
    animation: none;
  }
}
</style>
