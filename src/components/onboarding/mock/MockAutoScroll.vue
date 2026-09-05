<script setup lang="ts">
import AppIcon from "../../icons/AppIcon.vue";
import MockScreen from "./MockScreen.vue";
import MockTouch from "./MockTouch.vue";

/**
 * Le défilement automatique : le double appui, puis le texte qui remonte tout
 * seul, la pastille posée en bas. La boucle rejoue le geste pour qu'on
 * comprenne ce qui déclenche quoi.
 */

/** Longueurs des lignes, en pourcentage : du texte, pas un tramage régulier. */
const lines = [96, 88, 100, 71, 94, 90, 64, 98, 86, 93, 77, 96, 89, 68];
</script>

<template>
  <MockScreen height="10.5rem">
    <div class="scroller">
      <span
        v-for="(width, index) in lines"
        :key="index"
        class="line"
        :class="{ 'line-break': index % 4 === 3 }"
        :style="{ width: `${width}%` }"
      ></span>
    </div>

    <!-- Le double appui, au départ de chaque tour. -->
    <MockTouch class="tap" duration="7s" :taps="2" />

    <span class="pill">
      <AppIcon name="chevron-down" :size="10" class="drift" />
      <span class="pill-label"></span>
    </span>

    <span class="fade" aria-hidden="true"></span>
  </MockScreen>
</template>

<style scoped>
.scroller {
  position: absolute;
  inset: 0.9rem 1rem auto;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  animation: creep 7s linear infinite;
}

.line {
  height: 0.3rem;
  flex: none;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-text-primary) 13%, transparent);
}

/* Fin de paragraphe : un blanc, comme dans un vrai texte. */
.line-break {
  margin-bottom: 0.4rem;
}

/* La descente : le texte remonte lentement, puis le tour recommence. */
@keyframes creep {
  0%,
  12% {
    transform: translateY(0);
  }
  92%,
  100% {
    transform: translateY(-3.6rem);
  }
}

/* Le doigt reste le temps du double appui, puis laisse le texte descendre. */
.tap {
  top: 45%;
  left: 50%;
  animation: tap-fade 7s ease-out infinite;
}

@keyframes tap-fade {
  0%,
  20% {
    opacity: 1;
  }
  28%,
  94% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

.pill {
  position: absolute;
  bottom: 0.6rem;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  background-color: var(--color-surface);
  color: var(--color-primary);
  box-shadow: var(--shadow-pop);
  transform: translateX(-50%);
  opacity: 0;
  animation: pill 7s ease-out infinite;
}

.pill-label {
  display: block;
  width: 2.4rem;
  height: 0.3rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-text-primary) 30%, transparent);
}

@keyframes pill {
  0%,
  6% {
    opacity: 0;
    transform: translate(-50%, 0.6rem);
  }
  14%,
  92% {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, 0.6rem);
  }
}

.drift {
  animation: drift 1.6s ease-in-out infinite;
}

@keyframes drift {
  0%,
  100% {
    transform: translateY(-1px);
    opacity: 0.55;
  }
  50% {
    transform: translateY(1px);
    opacity: 1;
  }
}

/* Le texte s'efface sous la pastille plutôt que de la heurter. */
.fade {
  position: absolute;
  inset: auto 0 0;
  height: 2.4rem;
  background: linear-gradient(to bottom, transparent, var(--color-bg-beige));
}

:root.dark .fade {
  background: linear-gradient(to bottom, transparent, var(--color-bg-dark));
}

@media (prefers-reduced-motion: reduce) {
  .scroller,
  .tap,
  .drift {
    animation: none;
  }
  .tap {
    opacity: 0;
  }
  .pill {
    animation: none;
    opacity: 1;
    transform: translate(-50%, 0);
  }
}
</style>
