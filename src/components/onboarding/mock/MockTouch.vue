<script setup lang="ts">
/**
 * Le doigt des captures : un point de contact et l'onde qu'il laisse.
 *
 * Toutes les captures gestuelles s'en servent, pour que le même rond veuille
 * toujours dire « un doigt se pose ici ». La position et le déplacement
 * appartiennent à la capture qui l'accueille ; ici ne vivent que l'appui et
 * son onde, réglés sur la durée du tour (`duration`) et son décalage
 * (`delay`), pour tomber juste dans l'animation d'à côté.
 *
 * `taps` : 0 pour un doigt posé qui ne tape pas (le pincement), 1 pour un
 * appui, 2 pour un double appui.
 */
withDefaults(
  defineProps<{
    /** Durée d'un tour complet de la capture. */
    duration?: string;
    /** Décalage avant le premier appui. */
    delay?: string;
    taps?: 0 | 1 | 2;
  }>(),
  { duration: "5s", delay: "0s", taps: 1 },
);
</script>

<template>
  <span class="touch" :style="{ '--d': duration, '--delay': delay }" aria-hidden="true">
    <span class="tip" :class="`tip-${taps}`"></span>
    <span v-if="taps > 0" class="ripple"></span>
    <span v-if="taps > 1" class="ripple ripple-2"></span>
  </span>
</template>

<style scoped>
.touch {
  position: absolute;
  display: block;
  width: 1.3rem;
  height: 1.3rem;
  margin: -0.65rem 0 0 -0.65rem;
}

/* Le doigt : une pulpe pleine, un halo, et un reflet qui lui donne du volume. */
.tip {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: radial-gradient(
    circle at 34% 30%,
    color-mix(in srgb, #fff 55%, var(--color-primary)),
    var(--color-primary) 78%
  );
  box-shadow:
    0 0 0 0.28rem color-mix(in srgb, var(--color-primary) 22%, transparent),
    0 0.1rem 0.25rem rgb(0 0 0 / 0.25);
}

.tip-1 {
  animation: press-1 var(--d) ease-out var(--delay) infinite;
}

.tip-2 {
  animation: press-2 var(--d) ease-out var(--delay) infinite;
}

/* L'onde de l'appui, qui s'ouvre et s'efface. */
.ripple {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  border: 1.5px solid var(--color-primary);
  opacity: 0;
  animation: ripple var(--d) ease-out var(--delay) infinite;
}

.ripple-2 {
  animation-delay: calc(var(--delay) + 0.3s);
}

@keyframes press-1 {
  0% {
    transform: scale(1);
  }
  3% {
    transform: scale(0.78);
  }
  9%,
  100% {
    transform: scale(1);
  }
}

@keyframes press-2 {
  0% {
    transform: scale(1);
  }
  3% {
    transform: scale(0.78);
  }
  8% {
    transform: scale(1);
  }
  11% {
    transform: scale(0.78);
  }
  17%,
  100% {
    transform: scale(1);
  }
}

@keyframes ripple {
  0% {
    opacity: 0.7;
    transform: scale(0.6);
  }
  14% {
    opacity: 0;
    transform: scale(2.1);
  }
  100% {
    opacity: 0;
    transform: scale(2.1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tip,
  .ripple {
    animation: none;
  }
  .ripple {
    opacity: 0;
  }
}
</style>
