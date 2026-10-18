<script setup lang="ts">
import AppIcon from "../icons/AppIcon.vue";
import MockScreen from "./MockScreen.vue";
import MockTouch from "./MockTouch.vue";

/**
 * Mon parcours, on the home page: the day's readings as a stack of cards.
 * A finger swipes the first one to the right, it is done; the next one rises
 * to the front, the day bar fills a notch, and the streak light grows.
 * Shown by the "what's new" tour (WhatsNewTour.vue).
 */
</script>

<template>
  <MockScreen height="9.5rem">
    <div class="pane">
      <div class="head">
        <!-- The day bar: one notch per reading of the day. -->
        <span class="day-bar">
          <span class="notch notch-a"></span>
          <span class="notch notch-b"></span>
          <span class="notch"></span>
        </span>
        <span class="lamp"><AppIcon name="candle" :size="11" /></span>
      </div>

      <div class="deck">
        <span class="card card-c">
          <span class="name">Chnei mikra</span>
        </span>
        <span class="card card-b">
          <span class="name">Michna Berakhot</span>
          <span class="line"></span>
        </span>
        <span class="card card-a">
          <span class="name">Tehilim</span>
          <span class="line"></span>
          <span class="done"><AppIcon name="check" :size="9" /></span>
        </span>
        <MockTouch class="finger" duration="7s" delay="1.1s" :taps="0" />
      </div>
    </div>
  </MockScreen>
</template>

<style scoped>
.pane {
  position: absolute;
  inset: 0.8rem 1.2rem;
  font-size: 0.55rem;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.day-bar {
  display: flex;
  flex: 1;
  gap: 0.2rem;
}

.notch {
  height: 0.3rem;
  flex: 1;
  border-radius: 999px;
  background-color: var(--color-line-strong);
}

.notch-a {
  animation: notch-a 7s ease-out infinite;
}

.notch-b {
  animation: notch-b 7s ease-out infinite;
}

@keyframes notch-a {
  0%,
  30% {
    background-color: var(--color-line-strong);
  }
  34%,
  92% {
    background-color: var(--color-primary);
  }
  97%,
  100% {
    background-color: var(--color-line-strong);
  }
}

@keyframes notch-b {
  0%,
  66% {
    background-color: var(--color-line-strong);
  }
  70%,
  92% {
    background-color: var(--color-primary);
  }
  97%,
  100% {
    background-color: var(--color-line-strong);
  }
}

/* The streak light, which grows with each reading done. */
.lamp {
  display: inline-flex;
  width: 1.3rem;
  height: 1.3rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background-color: var(--color-brand);
  color: var(--color-on-brand);
  animation: lamp 7s ease-out infinite;
}

@keyframes lamp {
  0%,
  31% {
    transform: scale(0.8);
  }
  36% {
    transform: scale(1.2);
  }
  40%,
  67% {
    transform: scale(1);
  }
  72% {
    transform: scale(1.3);
  }
  76%,
  92% {
    transform: scale(1.12);
  }
  100% {
    transform: scale(0.8);
  }
}

.deck {
  position: relative;
  height: 5.6rem;
  margin-top: 0.7rem;
}

.card {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.35rem;
  padding: 0 0.8rem;
  border-radius: 0.6rem;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-card);
  color: var(--color-text-primary);
}

.name {
  font-size: 0.7rem;
  font-weight: 700;
}

.line {
  width: 60%;
  height: 0.25rem;
  border-radius: 999px;
  background-color: var(--color-line-strong);
}

/* Three cards, one behind the other: the first leaves to the right, the
   next one rises, and so on; all come back for the next round. */
.card-a {
  animation: card-a 7s ease-in-out infinite;
}

.card-b {
  animation: card-b 7s ease-in-out infinite;
}

.card-c {
  animation: card-c 7s ease-in-out infinite;
}

@keyframes card-a {
  0%,
  18% {
    transform: none;
    opacity: 1;
  }
  30% {
    transform: translateX(120%) rotate(10deg);
    opacity: 1;
  }
  31%,
  94% {
    transform: translateX(120%) rotate(10deg);
    opacity: 0;
  }
  100% {
    transform: none;
    opacity: 1;
  }
}

@keyframes card-b {
  0%,
  22% {
    transform: translateY(0.45rem) scale(0.94);
  }
  32%,
  54% {
    transform: none;
    opacity: 1;
  }
  66% {
    transform: translateX(120%) rotate(10deg);
    opacity: 1;
  }
  67%,
  94% {
    transform: translateX(120%) rotate(10deg);
    opacity: 0;
  }
  100% {
    transform: translateY(0.45rem) scale(0.94);
    opacity: 1;
  }
}

@keyframes card-c {
  0%,
  22% {
    transform: translateY(0.9rem) scale(0.88);
  }
  32%,
  58% {
    transform: translateY(0.45rem) scale(0.94);
  }
  68%,
  92% {
    transform: none;
    opacity: 1;
  }
  97% {
    opacity: 0;
  }
  100% {
    transform: translateY(0.9rem) scale(0.88);
    opacity: 1;
  }
}

/* The check of the card done, before it leaves. */
.done {
  position: absolute;
  top: 50%;
  right: 0.8rem;
  display: inline-flex;
  width: 1.1rem;
  height: 1.1rem;
  margin-top: -0.55rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background-color: var(--color-primary);
  color: #fff;
  opacity: 0;
  animation: done 7s ease-out infinite;
}

@keyframes done {
  0%,
  19% {
    opacity: 0;
    transform: scale(0.4);
  }
  23%,
  30% {
    opacity: 1;
    transform: scale(1);
  }
  31%,
  100% {
    opacity: 0;
  }
}

/* The finger lands on the card and swipes it to the right, twice. */
.finger {
  top: 55%;
  left: 35%;
  opacity: 0;
  animation: finger 7s ease-in-out infinite;
}

@keyframes finger {
  0%,
  12% {
    opacity: 0;
    transform: none;
  }
  16% {
    opacity: 1;
    transform: none;
  }
  27% {
    opacity: 1;
    transform: translateX(5rem);
  }
  30%,
  48% {
    opacity: 0;
    transform: none;
  }
  52% {
    opacity: 1;
    transform: none;
  }
  63% {
    opacity: 1;
    transform: translateX(5rem);
  }
  66%,
  100% {
    opacity: 0;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .notch,
  .lamp,
  .card,
  .done,
  .finger {
    animation: none;
  }
  .card-b {
    transform: translateY(0.45rem) scale(0.94);
  }
  .card-c {
    transform: translateY(0.9rem) scale(0.88);
  }
  .finger {
    opacity: 0;
  }
}
</style>
