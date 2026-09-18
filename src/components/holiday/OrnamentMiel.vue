<script setup lang="ts">
// Le pot de miel de Roch Hachana : un pot à couvercle, une cuillère à miel
// posée dedans, et une goutte qui perle au bord. Le miel prend la seconde
// couleur. À l'arrivée, la goutte descend le long du pot.
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
    <!-- le pot -->
    <path d="M19 26c-4 4-6 9-6 15 0 9 7 15 19 15s19-6 19-15c0-6-2-11-6-15" />
    <path d="M17 26h30" />
    <rect x="20" y="18" width="24" height="8" rx="2" />
    <!-- la cuillère à miel, qui dépasse du pot -->
    <path class="accent" d="M40 18 52 6" />
    <path class="accent" d="M44 16c-1 3 2 6 5 5s3-4 1-6" />
    <!-- la goutte qui perle -->
    <path class="accent drop" d="M28 44c0 2-2 3-2 5a2 2 0 0 0 4 0c0-2-2-3-2-5z" />
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
.drop {
  opacity: 0;
  animation: ornament-drop 0.8s ease-out 0.5s forwards;
}
@keyframes ornament-drop {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .drop {
    animation: none;
    opacity: 1;
  }
}
</style>
