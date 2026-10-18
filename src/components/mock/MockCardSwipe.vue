<script setup lang="ts">
import { useI18n } from "vue-i18n";
import MockScreen from "./MockScreen.vue";
import MockTouch from "./MockTouch.vue";

/**
 * The home page deck: the card of the moment, swiped to the right. The
 * « C'est fait » pill comes out at its edge as under a finger, takes the
 * theme color once far enough, the check mark lands on the card, which flies
 * off, and the next one rises in front (as in TaskDeck.vue).
 *
 * The swipe stays physical in Hebrew too, as in the deck: to the right.
 */

const { t } = useI18n();
</script>

<template>
  <MockScreen height="9.5rem">
    <div class="deck" dir="ltr">
      <div class="card card-next">
        <span class="bar bar-kicker"></span>
        <span class="bar bar-title"></span>
        <span class="bar bar-meta"></span>
      </div>

      <div class="card card-top">
        <span class="kicker"></span>
        <span class="title">{{ t("home.sidourNow.names.chaharit") }}</span>
        <span class="meta"></span>
        <span class="book" aria-hidden="true"></span>

        <!-- What the gesture will do, hung on the card's edge. -->
        <span class="cue">
          <svg viewBox="0 0 24 24" class="cue-icon"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          {{ t("parcours.hub.done") }}
        </span>
        <!-- C'est fait: the check mark, laid on the card before it flies off. -->
        <span class="stamp">
          <svg viewBox="0 0 24 24" class="stamp-icon"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <!-- The finger lives in the card it carries. -->
        <MockTouch class="finger" duration="6s" delay="0.6s" />
      </div>
    </div>
  </MockScreen>
</template>

<style scoped>
.deck {
  position: absolute;
  top: 1.7rem;
  left: 14%;
  width: 72%;
  height: 5.6rem;
}

.card {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.3rem;
  padding: 0 0.8rem;
  border-radius: 0.8rem;
}

.card-next {
  background-color: var(--color-surface);
  box-shadow: var(--shadow-card);
  transform: translateY(0.55rem) scale(0.92);
  animation: next 6s ease-in-out infinite;
}

.bar {
  display: block;
  height: 0.3rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-text-primary) 12%, transparent);
}

.bar-kicker {
  width: 30%;
}

.bar-title {
  width: 55%;
  height: 0.45rem;
}

.bar-meta {
  width: 40%;
}

.card-top {
  background-color: var(--color-brand);
  color: var(--color-on-brand);
  box-shadow: var(--shadow-card);
  animation: swipe 6s ease-in-out infinite;
}

.kicker,
.meta {
  display: block;
  height: 0.28rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-on-brand) 45%, transparent);
}

.kicker {
  width: 28%;
}

.meta {
  width: 36%;
}

.title {
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.1;
}

/* The book of the card, in its corner. */
.book {
  position: absolute;
  top: 0.75rem;
  right: 0.8rem;
  width: 1.8rem;
  height: 2.6rem;
  border-radius: 0.15rem 0.3rem 0.3rem 0.15rem;
  background-color: #1e3a5f;
  box-shadow:
    inset 0.18rem 0 0 rgb(0 0 0 / 0.25),
    0 0.15rem 0.3rem rgb(0 0 0 / 0.2);
  transform: rotate(6deg);
}

.cue {
  position: absolute;
  top: 50%;
  right: calc(100% + 0.4rem);
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.25rem 0.5rem 0.25rem 0.35rem;
  border-radius: 999px;
  background-color: var(--color-surface);
  color: var(--color-primary);
  box-shadow: var(--shadow-pop);
  font-size: 0.55rem;
  font-weight: 800;
  white-space: nowrap;
  opacity: 0;
  transform: translateY(-50%);
  animation: cue 6s ease-in-out infinite;
}

.cue-icon,
.stamp-icon {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.cue-icon {
  width: 0.6rem;
  height: 0.6rem;
  stroke-width: 2.8;
}

.stamp {
  position: absolute;
  top: 50%;
  left: 0.8rem;
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  place-items: center;
  border-radius: 999px;
  background-color: var(--color-surface);
  color: var(--color-primary);
  box-shadow: var(--shadow-pop);
  opacity: 0;
  transform: translateY(-50%) scale(0.3);
  animation: stamp 6s ease-in-out infinite;
}

.stamp-icon {
  width: 1.1rem;
  height: 1.1rem;
  stroke-width: 3;
}

.finger {
  top: 55%;
  left: 40%;
  opacity: 0;
  animation: finger 6s ease-in-out infinite;
}

/* The card follows the finger, tilting a little, then flies off; it comes
   back at the end of the loop, as if the day started over. */
@keyframes swipe {
  0%,
  12% {
    transform: none;
    opacity: 1;
  }
  38%,
  48% {
    transform: translateX(62%) rotate(7deg);
    opacity: 1;
  }
  60% {
    transform: translateX(150%) rotate(14deg);
    opacity: 0;
  }
  90% {
    transform: none;
    opacity: 0;
  }
  100% {
    transform: none;
    opacity: 1;
  }
}

/* The pill appears as the card moves, and takes the theme color once far
   enough: let go, it is done. */
@keyframes cue {
  0%,
  14% {
    opacity: 0;
    background-color: var(--color-surface);
    color: var(--color-primary);
  }
  28% {
    opacity: 1;
    background-color: var(--color-surface);
    color: var(--color-primary);
  }
  33%,
  48% {
    opacity: 1;
    background-color: var(--color-brand);
    color: var(--color-on-brand);
  }
  54%,
  100% {
    opacity: 0;
    background-color: var(--color-brand);
    color: var(--color-on-brand);
  }
}

@keyframes stamp {
  0%,
  40% {
    opacity: 0;
    transform: translateY(-50%) scale(0.3);
  }
  44%,
  52% {
    opacity: 1;
    transform: translateY(-50%) scale(1);
  }
  58%,
  100% {
    opacity: 0;
    transform: translateY(-50%) scale(1);
  }
}

/* The next card rises in front once the first has gone. */
@keyframes next {
  0%,
  52% {
    transform: translateY(0.55rem) scale(0.92);
  }
  64%,
  88% {
    transform: none;
  }
  96%,
  100% {
    transform: translateY(0.55rem) scale(0.92);
  }
}

@keyframes finger {
  0%,
  4% {
    opacity: 0;
  }
  9%,
  38% {
    opacity: 1;
  }
  44%,
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .card-top,
  .card-next,
  .cue,
  .stamp,
  .finger {
    animation: none;
  }
  /* The gesture at its threshold: the card pulled, the pill in color. */
  .card-top {
    transform: translateX(40%) rotate(5deg);
  }
  .cue {
    opacity: 1;
    background-color: var(--color-brand);
    color: var(--color-on-brand);
  }
  .finger {
    opacity: 1;
  }
}
</style>
