<script setup lang="ts">
import AppIcon from "../icons/AppIcon.vue";
import MockScreen from "./MockScreen.vue";
import MockTouch from "./MockTouch.vue";

/**
 * The class player: a finger touches a class in the list, the player bar
 * rises at the bottom and plays; a second touch opens it full screen, its
 * cover and its controls, then it folds back into the bar. Shown by the
 * "what's new" tour (WhatsNewTour.vue).
 */
</script>

<template>
  <MockScreen height="10rem">
    <div class="list">
      <span v-for="n in 3" :key="n" class="row">
        <span class="cover-sm"><AppIcon name="headphones" :size="8" /></span>
        <span class="bars">
          <span class="bar"></span>
          <span class="bar bar-short"></span>
        </span>
        <span class="play"><AppIcon name="play-solid" :size="7" /></span>
      </span>
      <MockTouch class="finger finger-row" duration="8s" delay="0.7s" />
    </div>

    <!-- The player: the bar, which grows into the full screen. -->
    <div class="player">
      <div class="mini">
        <span class="cover-sm"><AppIcon name="headphones" :size="8" /></span>
        <span class="bars">
          <span class="bar"></span>
          <span class="progress"><span class="progress-fill"></span></span>
        </span>
        <AppIcon name="pause-solid" :size="10" />
      </div>
      <div class="full">
        <span class="cover-lg"><AppIcon name="headphones" :size="20" /></span>
        <span class="progress progress-lg"><span class="progress-fill"></span></span>
        <span class="controls">
          <AppIcon name="skip-back" :size="11" />
          <span class="pause"><AppIcon name="pause-solid" :size="11" /></span>
          <AppIcon name="skip-forward" :size="11" />
        </span>
      </div>
      <MockTouch class="finger finger-bar" duration="8s" delay="2.4s" />
    </div>
  </MockScreen>
</template>

<style scoped>
.list {
  position: absolute;
  inset: 0.7rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.row,
.mini {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.5rem;
  border-radius: 0.5rem;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-card);
  color: var(--color-text-primary);
}

.cover-sm,
.cover-lg {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 0.3rem;
  background-color: var(--color-brand);
  color: var(--color-on-brand);
}

.cover-sm {
  width: 1.1rem;
  height: 1.1rem;
}

.cover-lg {
  width: 3.4rem;
  height: 3.4rem;
  border-radius: 0.6rem;
}

.bars {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.2rem;
}

.bar {
  width: 70%;
  height: 0.22rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-text-primary) 30%, transparent);
}

.bar-short {
  width: 45%;
  background-color: var(--color-line-strong);
}

.play,
.pause {
  display: inline-flex;
  width: 1.1rem;
  height: 1.1rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background-color: var(--color-primary);
  color: #fff;
}

.pause {
  width: 1.6rem;
  height: 1.6rem;
}

.progress {
  position: relative;
  height: 0.16rem;
  overflow: hidden;
  border-radius: 999px;
  background-color: var(--color-line-strong);
}

.progress-lg {
  width: 70%;
}

.progress-fill {
  position: absolute;
  inset: 0;
  background-color: var(--color-primary);
  transform-origin: left;
  animation: progress 8s linear infinite;
}

@keyframes progress {
  0%,
  16% {
    transform: scaleX(0);
  }
  90%,
  100% {
    transform: scaleX(0.8);
  }
}

/* The player, out of sight; then the bar at the bottom, then the full
   screen, then the bar again. */
.player {
  position: absolute;
  inset: auto 0.5rem 0.5rem;
  top: 100%;
  border-radius: 0.6rem;
  background-color: var(--color-surface);
  box-shadow: 0 -0.3rem 0.9rem rgb(0 0 0 / 0.12);
  overflow: hidden;
  animation: player 8s cubic-bezier(0.3, 1.1, 0.55, 1) infinite;
}

@keyframes player {
  0%,
  12% {
    top: 100%;
  }
  18%,
  32% {
    top: calc(100% - 2.4rem);
  }
  40%,
  76% {
    top: 0.5rem;
  }
  84%,
  92% {
    top: calc(100% - 2.4rem);
  }
  100% {
    top: 100%;
  }
}

.mini {
  position: absolute;
  inset: 0 0 auto;
  height: 1.9rem;
  box-shadow: none;
  animation: mini 8s ease infinite;
}

@keyframes mini {
  0%,
  33% {
    opacity: 1;
  }
  37%,
  80% {
    opacity: 0;
  }
  84%,
  100% {
    opacity: 1;
  }
}

.full {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  color: var(--color-text-primary);
  opacity: 0;
  animation: full 8s ease infinite;
}

@keyframes full {
  0%,
  36% {
    opacity: 0;
  }
  42%,
  74% {
    opacity: 1;
  }
  78%,
  100% {
    opacity: 0;
  }
}

.controls {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

/* The finger: on the first class, then on the player bar. */
.finger {
  opacity: 0;
}

.finger-row {
  top: 0.9rem;
  left: 80%;
  animation: finger-row 8s ease-in-out infinite;
}

.finger-bar {
  top: 1rem;
  left: 50%;
  animation: finger-bar 8s ease-in-out infinite;
}

@keyframes finger-row {
  0%,
  6% {
    opacity: 0;
  }
  9%,
  15% {
    opacity: 1;
  }
  19%,
  100% {
    opacity: 0;
  }
}

@keyframes finger-bar {
  0%,
  26% {
    opacity: 0;
  }
  29%,
  35% {
    opacity: 1;
  }
  39%,
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .player,
  .mini,
  .full,
  .progress-fill,
  .finger {
    animation: none;
  }
  .player {
    top: calc(100% - 2.4rem);
  }
  .full,
  .finger {
    opacity: 0;
  }
}
</style>
