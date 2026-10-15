<script setup lang="ts">
/**
 * Les trois barres qui disent « c'est ce cours qui joue », à la place de son
 * numéro ou sur sa pochette. Elles dansent pendant la lecture et se figent en
 * pause ; en mouvement réduit, elles restent immobiles.
 */
defineProps<{ playing: boolean }>();
</script>

<template>
  <span
    class="now-playing inline-flex h-3.5 items-end gap-[2px]"
    :class="{ playing }"
    aria-hidden="true"
  >
    <span class="bar" />
    <span class="bar" />
    <span class="bar" />
  </span>
</template>

<style scoped>
.bar {
  width: 3px;
  height: 100%;
  border-radius: 1px;
  background: currentColor;
  transform-origin: bottom;
}
.bar:nth-child(1) {
  transform: scaleY(0.55);
}
.bar:nth-child(2) {
  transform: scaleY(1);
}
.bar:nth-child(3) {
  transform: scaleY(0.75);
}
.playing .bar {
  animation: bounce 0.9s ease-in-out infinite alternate;
}
.playing .bar:nth-child(2) {
  animation-delay: -0.3s;
}
.playing .bar:nth-child(3) {
  animation-delay: -0.6s;
}
@keyframes bounce {
  from {
    transform: scaleY(0.3);
  }
  to {
    transform: scaleY(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .playing .bar {
    animation: none;
  }
}
/* Rendu dégradé (useDevicePerf) : pas d'animation continue. */
:root.perf-lite .playing .bar {
  animation: none;
}
</style>
