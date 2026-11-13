<script setup lang="ts">
import { useI18n } from "vue-i18n";
import MockScreen from "./MockScreen.vue";
import MockTouch from "./MockTouch.vue";

/**
 * The home page to your taste: a finger holds a block, which lifts, follows
 * it up, the others sliding aside, and settles once let go (useHomeArrange).
 * Then back down, so that the loop ends as it began.
 */

const { t } = useI18n();
</script>

<template>
  <MockScreen height="10.5rem">
    <div class="blocks">
      <div class="block block-a">
        <span class="name">{{ t("home.edit.blocks.horaires.title") }}</span>
        <span class="time">10:06</span>
      </div>
      <div class="block block-b">
        <span class="name">{{ t("home.edit.blocks.volumes.title") }}</span>
        <span class="spines">
          <span class="spine" style="--c: #7a3b2e"></span>
          <span class="spine" style="--c: #2f4a3a"></span>
        </span>
      </div>
      <div class="block block-c">
        <span class="name">{{ t("home.edit.blocks.livres.title") }}</span>
        <span class="spines">
          <span class="spine" style="--c: #1e3a5f"></span>
          <span class="spine" style="--c: #6b5a2b"></span>
          <span class="spine" style="--c: #5a2f3f"></span>
        </span>
        <!-- The long press: a ring closes around the finger before the block lifts. -->
        <span class="hold" aria-hidden="true"></span>
        <MockTouch class="finger" :taps="0" />
      </div>
    </div>
  </MockScreen>
</template>

<style scoped>
.blocks {
  position: absolute;
  inset: 0.85rem 1rem;
  --step: 3rem;
}

.block {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  height: 2.6rem;
  padding: 0 0.7rem;
  border-radius: 0.6rem;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-card);
  font-size: 0.55rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.block-a {
  top: 0;
  animation: slide-a 8s ease-in-out infinite;
}

.block-b {
  top: var(--step);
  animation: slide-b 8s ease-in-out infinite;
}

.block-c {
  top: calc(2 * var(--step));
  z-index: 1;
  animation: carry 8s ease-in-out infinite;
}

.name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time {
  font-family: var(--font-display);
  font-size: 0.95rem;
  color: var(--color-primary);
}

.spines {
  display: flex;
  flex: none;
  gap: 0.2rem;
}

.spine {
  display: block;
  width: 0.65rem;
  height: 1.5rem;
  border-radius: 0.08rem 0.16rem 0.16rem 0.08rem;
  background-color: var(--c);
  box-shadow: inset 0.08rem 0 0 rgb(0 0 0 / 0.22);
}

.finger {
  top: 55%;
  left: 38%;
  opacity: 0;
  animation: finger 8s ease-in-out infinite;
}

.hold {
  position: absolute;
  top: 55%;
  left: 38%;
  width: 2.4rem;
  height: 2.4rem;
  margin: -1.2rem 0 0 -1.2rem;
  border-radius: 999px;
  border: 0.12rem solid var(--color-primary);
  opacity: 0;
  animation: hold 8s ease-out infinite;
}

/* Held, lifted, carried to the top, set down; then, held again, carried
   back to the bottom. */
@keyframes carry {
  0%,
  16% {
    transform: none;
    box-shadow: var(--shadow-card);
  }
  20% {
    transform: scale(1.04);
    box-shadow: var(--shadow-pop);
  }
  40% {
    transform: translateY(calc(-2 * var(--step))) scale(1.04);
    box-shadow: var(--shadow-pop);
  }
  45%,
  64% {
    transform: translateY(calc(-2 * var(--step)));
    box-shadow: var(--shadow-card);
  }
  68% {
    transform: translateY(calc(-2 * var(--step))) scale(1.04);
    box-shadow: var(--shadow-pop);
  }
  88% {
    transform: scale(1.04);
    box-shadow: var(--shadow-pop);
  }
  93%,
  100% {
    transform: none;
    box-shadow: var(--shadow-card);
  }
}

/* The others step aside as the held block passes their middle. */
@keyframes slide-b {
  0%,
  26% {
    transform: none;
  }
  32%,
  78% {
    transform: translateY(var(--step));
  }
  84%,
  100% {
    transform: none;
  }
}

@keyframes slide-a {
  0%,
  33% {
    transform: none;
  }
  39%,
  71% {
    transform: translateY(var(--step));
  }
  77%,
  100% {
    transform: none;
  }
}

@keyframes finger {
  0%,
  4% {
    opacity: 0;
  }
  8%,
  42% {
    opacity: 1;
  }
  47%,
  53% {
    opacity: 0;
  }
  57%,
  90% {
    opacity: 1;
  }
  95%,
  100% {
    opacity: 0;
  }
}

@keyframes hold {
  0%,
  8% {
    opacity: 0;
    transform: scale(0.4);
  }
  12% {
    opacity: 0.8;
    transform: scale(0.6);
  }
  19% {
    opacity: 0;
    transform: scale(1.1);
  }
  57% {
    opacity: 0;
    transform: scale(0.4);
  }
  61% {
    opacity: 0.8;
    transform: scale(0.6);
  }
  68%,
  100% {
    opacity: 0;
    transform: scale(1.1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .block,
  .finger,
  .hold {
    animation: none;
  }
  /* The block lifted, on its way up, the finger on it. */
  .block-c {
    transform: translateY(calc(-0.6 * var(--step))) scale(1.04);
    box-shadow: var(--shadow-pop);
  }
  .finger {
    opacity: 1;
  }
}
</style>
