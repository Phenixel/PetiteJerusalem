<script setup lang="ts">
// Le loulav de Souccot, lié et tenu de biais : la palme, une longue lame
// fine, monte au milieu ; à sa gauche le myrte aux feuilles rondes, à sa
// droite le saule aux feuilles effilées ; en bas, l'anneau tressé qui tient
// le tout, à la seconde couleur, comme les éclats. À l'arrivée, la palme se
// déploie du bas vers le haut.
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
    <g transform="rotate(24 32 46)">
      <!-- la palme -->
      <g class="palm">
        <path d="M32 46C29 34 29 18 33 3c4 15 4 31 -1 43z" />
      </g>
      <!-- le myrte, à gauche -->
      <path d="M27 48c-2-8-4-16-8-24" />
      <path d="M22 30c-4 0-6-3-6-7 4 0 6 3 6 7z" />
      <path d="M24 38c-4 0-7-2-7-6 4 0 7 2 7 6z" />
      <path d="M21 32c1-4 4-6 8-6-1 4-4 6-8 6z" />
      <!-- le saule, à droite -->
      <path d="M37 48c2-8 5-15 10-22" />
      <path d="M43 32c1-5 4-8 8-9-1 5-4 8-8 9z" />
      <path d="M40 40c0-5 2-8 6-10 0 5-2 8-6 10z" />
      <!-- le lien tressé -->
      <path class="accent" d="M24 50h16" />
      <path class="accent" d="M24 56h16" />
      <path class="accent" d="m26 50 5 6" />
      <path class="accent" d="m33 50 5 6" />
      <!-- les tiges qui dépassent -->
      <path d="M28 56v6" />
      <path d="M33 56v6" />
      <path d="M37 56v5" />
    </g>
    <!-- les éclats -->
    <path class="accent" d="m6 30-4-2" />
    <path class="accent" d="M8 38H4" />
    <path class="accent" d="m58 40 4-1" />
    <path class="accent" d="m56 48 4 1" />
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
  transform-origin: 32px 46px;
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
