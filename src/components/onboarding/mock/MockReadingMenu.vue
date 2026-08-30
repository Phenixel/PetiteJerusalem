<script setup lang="ts">
import AppIcon from "../../icons/AppIcon.vue";
import MockScreen from "./MockScreen.vue";
import MockTouch from "./MockTouch.vue";

/**
 * Le menu de lecture : le rond posé en bas à droite du texte, et le panneau
 * qui en surgit. La boucle montre le doigt qui l'ouvre, le panneau ouvert, puis
 * le retour au rond, pour qu'on sache quoi chercher et ce qu'on y trouve.
 */
</script>

<template>
  <MockScreen height="10.5rem">
    <div class="lines">
      <span v-for="line in 6" :key="line" class="line" :style="{ '--i': line }"></span>
    </div>

    <!-- Le panneau, tel qu'il s'ouvre depuis le coin du bouton. -->
    <div class="panel">
      <div class="panel-head">
        <span class="chip">A−</span>
        <span class="chip">A+</span>
        <span class="chip chip-on">א</span>
      </div>
      <span class="panel-row"></span>
      <span class="panel-row short"></span>
    </div>

    <span class="fab"><AppIcon name="list" :size="12" /></span>
    <MockTouch class="tap" duration="6s" delay="1.1s" :taps="1" />
  </MockScreen>
</template>

<style scoped>
.lines {
  position: absolute;
  inset: 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.line {
  height: 0.3rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-text-primary) 13%, transparent);
  width: calc(100% - var(--i) * 4%);
}

.fab {
  position: absolute;
  right: 0.7rem;
  bottom: 0.7rem;
  display: flex;
  width: 1.7rem;
  height: 1.7rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-pop);
  animation: fab-fade 6s ease-in-out infinite;
}

/* Le doigt qui vient l'ouvrir, une fois par tour : posé sur le bouton rond,
   il s'efface le temps que le panneau occupe la place. */
.touch.tap {
  top: auto;
  left: auto;
  /* Posé sur le coin du bouton rond plutôt que dessus : on doit continuer
     de voir ce que le doigt vient toucher. */
  right: 0.45rem;
  bottom: 0.45rem;
  margin: 0;
  animation: tap-fade 6s ease-in-out infinite;
}

.panel {
  position: absolute;
  right: 0.7rem;
  bottom: 0.7rem;
  width: 7.5rem;
  padding: 0.45rem;
  border-radius: 0.75rem;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-pop);
  transform-origin: bottom right;
  opacity: 0;
  animation: panel 6s ease-in-out infinite;
}

.panel-head {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.4rem;
}

.chip {
  flex: 1;
  border-radius: 0.35rem;
  background-color: color-mix(in srgb, var(--color-text-primary) 8%, transparent);
  padding: 0.1rem 0;
  text-align: center;
  font-size: 0.5rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.chip-on {
  background-color: color-mix(in srgb, var(--color-primary) 15%, transparent);
  color: var(--color-primary);
}

.panel-row {
  display: block;
  height: 0.3rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-text-primary) 12%, transparent);
  margin-top: 0.3rem;
}

.panel-row.short {
  width: 65%;
}

@keyframes tap-fade {
  0%,
  12% {
    opacity: 0;
  }
  18%,
  30% {
    opacity: 1;
  }
  38%,
  100% {
    opacity: 0;
  }
}

@keyframes panel {
  0%,
  28% {
    opacity: 0;
    transform: translateY(6px) scale(0.8);
  }
  38%,
  82% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  92%,
  100% {
    opacity: 0;
    transform: translateY(6px) scale(0.8);
  }
}

/* Le bouton s'efface pendant que le panneau prend sa place. */
@keyframes fab-fade {
  0%,
  30% {
    opacity: 1;
    transform: scale(1);
  }
  38%,
  86% {
    opacity: 0;
    transform: scale(0.6);
  }
  94%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .touch.tap,
  .fab {
    animation: none;
  }
  .touch.tap {
    opacity: 0;
  }
  .fab {
    opacity: 0;
  }
  .panel {
    animation: none;
    opacity: 1;
  }
  .tap {
    opacity: 0;
  }
}
</style>
