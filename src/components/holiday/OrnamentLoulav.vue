<script setup lang="ts">
// Le loulav de Souccot, lié : la palme au centre, qui monte haut ; à sa
// gauche les trois branches de myrte, à sa droite les deux de saule, et
// l'anneau de feuilles tressées qui tient le tout. L'anneau prend la seconde
// couleur. À l'arrivée, la palme se déploie du bas vers le haut.
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
    <!-- la palme -->
    <g class="palm">
      <path d="M32 60V6" />
      <path d="M32 12l-4 6" />
      <path d="M32 12l4 6" />
      <path d="M32 20l-4 6" />
      <path d="M32 20l4 6" />
      <path d="M32 28l-4 6" />
      <path d="M32 28l4 6" />
    </g>
    <!-- le myrte, à gauche -->
    <path d="M26 60V36" />
    <path d="M26 40c-3-1-5-3-5-6 3 0 5 2 5 6z" />
    <path d="M26 48c-3-1-5-3-5-6 3 0 5 2 5 6z" />
    <!-- le saule, à droite -->
    <path d="M38 60V36" />
    <path d="M38 42c3 0 5-2 5-6-3 0-5 2-5 6z" />
    <path d="M38 50c3 0 5-2 5-6-3 0-5 2-5 6z" />
    <!-- l'anneau qui lie -->
    <path class="accent" d="M22 52h20" />
    <path class="accent" d="M22 56h20" />
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
.palm {
  transform-origin: 32px 60px;
  animation: ornament-grow 0.7s ease-out forwards;
}
@keyframes ornament-grow {
  from {
    transform: scaleY(0.6);
    opacity: 0;
  }
  to {
    transform: scaleY(1);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .palm {
    animation: none;
  }
}
</style>
