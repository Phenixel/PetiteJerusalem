<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import MockScreen from "./MockScreen.vue";
import MockTouch from "./MockTouch.vue";

/**
 * The reading bar slid with a finger (ReadingProgressBar.vue): the line
 * rises in a bump under the finger, the passage reached rides on top with
 * its share of the text, the page follows; let go, the line falls back flat
 * and the reading is there.
 *
 * In Hebrew the bar fills from the right and the finger slides to the left,
 * as in the app (`--way`).
 */

const { t, locale } = useI18n();
/** 1 from the left, -1 from the right (Hebrew). */
const way = computed(() => (locale.value === "he" ? -1 : 1));

const stops = computed(() => {
  const percent = new Intl.NumberFormat(locale.value, { style: "percent" });
  return [
    { title: `${t("common.chapter")} 2`, share: percent.format(0.18) },
    { title: `${t("common.chapter")} 5`, share: percent.format(0.46) },
    { title: `${t("common.chapter")} 9`, share: percent.format(0.79) },
  ];
});
</script>

<template>
  <MockScreen height="10.5rem" :style="{ '--way': way }">
    <div class="viewport">
      <div class="page">
        <span v-for="line in 18" :key="line" class="line" :style="{ '--i': line % 5 }"></span>
      </div>
    </div>

    <div class="strip" :class="{ 'from-right': way < 0 }">
      <span class="track"></span>
      <span class="fill"></span>
      <div class="thumb">
        <!-- The bump: the line held up, its paper hiding the text it rises over. -->
        <svg class="bump" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 30 C30 30 32 2 50 2 C68 2 70 30 100 30 Z" class="bump-paper" />
          <path d="M0 30 C30 30 32 2 50 2 C68 2 70 30 100 30" class="bump-line" />
        </svg>
        <span class="knob"></span>
        <span class="labels">
          <span v-for="(stop, i) in stops" :key="stop.title" class="label" :class="`label-${i}`">
            <span class="label-title">{{ stop.title }}</span>
            <span class="label-share">{{ stop.share }}</span>
          </span>
        </span>
        <MockTouch class="finger" duration="7s" delay="0.7s" :taps="0" />
      </div>
    </div>
  </MockScreen>
</template>

<style scoped>
.viewport {
  position: absolute;
  inset: 0 0 1.6rem;
  overflow: hidden;
}

.page {
  display: flex;
  flex-direction: column;
  gap: 0.42rem;
  padding: 0.9rem 1rem;
  animation: scroll 7s ease-in-out infinite;
}

.line {
  display: block;
  flex: none;
  height: 0.28rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-text-primary) 12%, transparent);
  width: calc(100% - var(--i) * 9%);
}

.strip {
  position: absolute;
  inset: auto 0.9rem 1.05rem;
  height: 0.12rem;
}

.track,
.fill {
  position: absolute;
  inset: 0;
  border-radius: 999px;
}

.track {
  background-color: color-mix(in srgb, var(--color-text-primary) 14%, transparent);
}

.fill {
  background-color: var(--color-primary);
  transform-origin: left;
  transform: scaleX(0.12);
  animation: fill 7s ease-in-out infinite;
}

.from-right .fill {
  transform-origin: right;
}

/* Placed from the middle: 12 % to 82 % of the way, from the right in Hebrew. */
.thumb {
  position: absolute;
  bottom: 0;
  left: calc(50% + var(--way) * -38%);
  width: 0;
  animation: thumb 7s ease-in-out infinite;
}

.bump {
  position: absolute;
  bottom: -0.06rem;
  left: -2.6rem;
  width: 5.2rem;
  height: 1.5rem;
  overflow: visible;
  transform-origin: bottom;
  transform: scaleY(0);
  animation: bump 7s ease-in-out infinite;
}

.bump-paper {
  fill: var(--color-bg-beige);
}

:root.dark .bump-paper {
  fill: #111827;
}

:root.dark .label {
  --halo: #111827;
}

.bump-line {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 2.4;
  vector-effect: non-scaling-stroke;
}

.knob {
  position: absolute;
  bottom: 1.25rem;
  left: -0.25rem;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background-color: var(--color-primary);
  opacity: 0;
  animation: knob 7s ease-in-out infinite;
}

/* The passage reached, on top of the bump, and its share. */
.labels {
  position: absolute;
  bottom: 1.9rem;
  left: -4rem;
  width: 8rem;
  height: 1.6rem;
}

/* A halo of the page's color keeps them legible over the text, as in the app. */
.label {
  --halo: var(--color-bg-beige);
  position: absolute;
  inset: 0;
  text-shadow:
    0 0 0.15rem var(--halo),
    0 0 0.3rem var(--halo),
    0 0 0.45rem var(--halo);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  opacity: 0;
  animation-duration: 7s;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}

.label-0 {
  animation-name: label-0;
}

.label-1 {
  animation-name: label-1;
}

.label-2 {
  animation-name: label-2;
}

.label-title {
  font-family: var(--font-display);
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1.1;
  color: var(--color-primary);
  white-space: nowrap;
}

.label-share {
  font-size: 0.48rem;
  font-weight: 700;
  color: var(--color-text-secondary);
}

.finger {
  top: 0.3rem;
  left: 0;
  opacity: 0;
  animation: finger 7s ease-in-out infinite;
}

/* The finger lands at 12 %, slides to 82 %, lets go. */
@keyframes thumb {
  0%,
  14% {
    left: calc(50% + var(--way) * -38%);
  }
  62%,
  92% {
    left: calc(50% + var(--way) * 32%);
  }
  100% {
    left: calc(50% + var(--way) * -38%);
  }
}

@keyframes fill {
  0%,
  14% {
    transform: scaleX(0.12);
  }
  62%,
  92% {
    transform: scaleX(0.82);
  }
  100% {
    transform: scaleX(0.12);
  }
}

@keyframes bump {
  0%,
  10% {
    transform: scaleY(0);
  }
  16%,
  64% {
    transform: scaleY(1);
  }
  70% {
    transform: scaleY(-0.12);
  }
  74%,
  100% {
    transform: scaleY(0);
  }
}

@keyframes knob {
  0%,
  12% {
    opacity: 0;
  }
  16%,
  64% {
    opacity: 1;
  }
  68%,
  100% {
    opacity: 0;
  }
}

@keyframes finger {
  0%,
  6% {
    opacity: 0;
  }
  10%,
  64% {
    opacity: 1;
  }
  70%,
  100% {
    opacity: 0;
  }
}

/* The page follows the finger, and stays where it was let go. */
@keyframes scroll {
  0%,
  14% {
    transform: none;
  }
  62%,
  92% {
    transform: translateY(-3.6rem);
  }
  100% {
    transform: none;
  }
}

@keyframes label-0 {
  0%,
  14% {
    opacity: 0;
  }
  18%,
  28% {
    opacity: 1;
  }
  32%,
  100% {
    opacity: 0;
  }
}

@keyframes label-1 {
  0%,
  30% {
    opacity: 0;
  }
  34%,
  44% {
    opacity: 1;
  }
  48%,
  100% {
    opacity: 0;
  }
}

@keyframes label-2 {
  0%,
  46% {
    opacity: 0;
  }
  50%,
  64% {
    opacity: 1;
  }
  68%,
  100% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .page,
  .fill,
  .thumb,
  .bump,
  .knob,
  .label,
  .finger {
    animation: none;
  }
  /* The finger halfway, the bump up, the passage named. */
  .thumb {
    left: calc(50% + var(--way) * -4%);
  }
  .fill {
    transform: scaleX(0.46);
  }
  .bump {
    transform: none;
  }
  .knob,
  .finger,
  .label:nth-child(2) {
    opacity: 1;
  }
  .page {
    transform: translateY(-1.8rem);
  }
}
</style>
