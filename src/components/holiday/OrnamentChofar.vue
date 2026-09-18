<script setup lang="ts">
// Le chofar de Roch Hachana : une corne de bélier qui s'évase, l'embouchure
// en bas à gauche, le pavillon en haut à droite. Les deux anneaux de la
// corne prennent la seconde couleur. À l'arrivée, la corne se dessine de
// l'embouchure au pavillon, comme le souffle qui la traverse.
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
    <path class="draw" d="M8 42c12-2 26-6 34-16S52 12 54 6" />
    <path class="draw" d="M12 48c10-2 24-6 32-16S57 16 60 10" />
    <path d="M8 42l4 6" />
    <path d="M54 6q5 0 6 4" />
    <path class="accent" d="M24 40l3 6" />
    <path class="accent" d="M36 33l4 5" />
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
.draw {
  stroke-dasharray: 80;
  stroke-dashoffset: 80;
  animation: ornament-draw 0.9s ease-out forwards;
}
@keyframes ornament-draw {
  to {
    stroke-dashoffset: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .draw {
    animation: none;
    stroke-dashoffset: 0;
  }
}
</style>
