<script setup lang="ts">
import MockScreen from "./MockScreen.vue";
import MockTouch from "./MockTouch.vue";

/**
 * Le pincement : le texte grossit et rétrécit pendant que deux doigts
 * s'écartent. C'est la taille du TEXTE qui bouge, pas la page : les lignes se
 * recomposent, le cadre ne bouge pas.
 */
</script>

<template>
  <MockScreen height="10.5rem">
    <div class="page">
      <p class="he">בְּרֵאשִׁית בָּרָא אֱלֹהִים</p>
      <p class="ph">Berechit bara Elokim</p>
      <p class="he">אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ</p>
      <p class="ph">ète hachamayim vé-ète haaretz</p>
    </div>
    <MockTouch class="finger finger-a" duration="5s" :taps="0" />
    <MockTouch class="finger finger-b" duration="5s" :taps="0" />
  </MockScreen>
</template>

<style scoped>
.page {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.3em;
  padding: 0 1rem;
  font-size: 0.6rem;
  line-height: 1.45;
  text-align: center;
  animation: pinch-size 5s ease-in-out infinite;
}

.he {
  font-family: var(--font-hebrew);
  color: var(--color-text-primary);
  direction: rtl;
}

.ph {
  font-size: 0.85em;
  color: var(--color-text-secondary);
}

@keyframes pinch-size {
  0%,
  20% {
    font-size: 0.6rem;
  }
  50%,
  70% {
    font-size: 0.95rem;
  }
  100% {
    font-size: 0.6rem;
  }
}

/* Les deux doigts, qui s'écartent en même temps que le texte grossit. */
.finger {
  top: 50%;
  left: 50%;
}

.finger-a {
  animation: pinch-a 5s ease-in-out infinite;
}

.finger-b {
  animation: pinch-b 5s ease-in-out infinite;
}

@keyframes pinch-a {
  0%,
  20% {
    transform: translate(-1.1rem, 0.9rem);
  }
  50%,
  70% {
    transform: translate(-2.6rem, 2rem);
  }
  100% {
    transform: translate(-1.1rem, 0.9rem);
  }
}

@keyframes pinch-b {
  0%,
  20% {
    transform: translate(1.1rem, -0.9rem);
  }
  50%,
  70% {
    transform: translate(2.6rem, -2rem);
  }
  100% {
    transform: translate(1.1rem, -0.9rem);
  }
}

/* Rendu dégradé : l'animation de taille recalcule la mise en page à chaque
   image, c'est la seule de l'introduction dans ce cas. */
:root.perf-lite .page {
  animation: none;
}

@media (prefers-reduced-motion: reduce) {
  .page,
  .finger-a,
  .finger-b {
    animation: none;
  }
  .finger-a {
    transform: translate(-2rem, 1.6rem);
  }
  .finger-b {
    transform: translate(2rem, -1.6rem);
  }
}
</style>
