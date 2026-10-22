<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "../icons/AppIcon.vue";
import MockScreen from "./MockScreen.vue";
import MockTouch from "./MockTouch.vue";

/**
 * The end of a service, pushed up past its end (PullToMark.vue, endPull.ts):
 * at the bottom of the text, the small line « Tirez vers le haut »; a finger
 * pushes the page up again, the ring swells, comes to the middle and fills;
 * let go full, the service is said, « Cha'harit : c'est fait ».
 */

const { t } = useI18n();
const done = computed(() => t("sidour.said.done", { name: t("home.sidourNow.names.chaharit") }));
</script>

<template>
  <MockScreen height="11rem">
    <div class="page">
      <span v-for="line in 5" :key="line" class="line" :style="{ '--i': line % 3 }"></span>
    </div>

    <!-- At rest: the small line at the end of the text. -->
    <div class="rest">
      <span class="dial-small"></span>
      <span>
        <b>{{ t("parcours.reader.pull") }}</b>
        {{ t("sidour.said.pullSub") }}
      </span>
    </div>

    <!-- Pulled: the ring swells in the middle and fills; full, the check. -->
    <div class="grow">
      <span class="kicker">{{ t("sidour.said.end") }}</span>
      <span class="dial">
        <svg viewBox="0 0 44 44" class="dial-svg" aria-hidden="true">
          <circle cx="22" cy="22" r="19" class="dial-track" />
          <circle cx="22" cy="22" r="19" class="dial-fill" />
        </svg>
        <AppIcon name="check" :size="18" class="dial-check" />
      </span>
      <span class="title title-release">{{ t("parcours.reader.release") }}</span>
      <span class="title title-done">{{ done }}</span>
      <span class="sub sub-release">{{ t("sidour.said.releaseSub") }}</span>
      <span class="sub sub-done">{{ t("sidour.said.doneSub") }}</span>
    </div>

    <MockTouch class="finger" duration="6s" delay="0.9s" :taps="0" />
  </MockScreen>
</template>

<style scoped>
.page {
  position: absolute;
  inset: 0.8rem 1rem auto;
  display: flex;
  flex-direction: column;
  gap: 0.42rem;
  animation: page 6s ease-in-out infinite;
}

.line {
  display: block;
  height: 0.28rem;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--color-text-primary) 12%, transparent);
  width: calc(100% - var(--i) * 12%);
}

.rest {
  position: absolute;
  inset: auto 1rem 1.1rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.55rem;
  color: var(--color-text-secondary);
  animation: rest 6s ease-in-out infinite;
}

.rest b {
  color: var(--color-text-primary);
}

.dial-small {
  width: 0.7rem;
  height: 0.7rem;
  flex: none;
  border-radius: 999px;
  border: 1.5px solid color-mix(in srgb, var(--color-text-primary) 25%, transparent);
}

.grow {
  position: absolute;
  inset: auto 0 0.3rem;
  height: 5.6rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding-top: 0.5rem;
  background-color: var(--color-bg-beige);
  opacity: 0;
  animation: grow 6s ease-in-out infinite;
}

:root.dark .grow {
  background-color: #111827;
}

.kicker {
  font-size: 0.48rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

/* Not `.ring`: Tailwind owns that class (a box-shadow ring). */
.dial {
  position: relative;
  display: grid;
  width: 2.4rem;
  height: 2.4rem;
  place-items: center;
}

.dial-svg {
  position: absolute;
  inset: 0;
  transform: rotate(-90deg);
}

.dial-track,
.dial-fill {
  fill: none;
  stroke-width: 4;
}

.dial-track {
  stroke: color-mix(in srgb, var(--color-text-primary) 12%, transparent);
}

/* The ring fills as the page is pushed: 120 px of the app, here its circle. */
.dial-fill {
  stroke: var(--color-brand);
  stroke-linecap: round;
  stroke-dasharray: 120;
  stroke-dashoffset: 120;
  animation: fill 6s ease-in-out infinite;
}

.dial-check {
  color: var(--color-primary);
  opacity: 0;
  animation: check 6s ease-in-out infinite;
}

.title,
.sub {
  position: absolute;
  left: 0;
  right: 0;
  text-align: center;
}

.title {
  top: 3.25rem;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.sub {
  top: 4.25rem;
  font-size: 0.5rem;
  color: var(--color-text-secondary);
}

.title-release,
.sub-release {
  animation: release 6s ease-in-out infinite;
}

.title-done,
.sub-done {
  opacity: 0;
  animation: said 6s ease-in-out infinite;
}

.finger {
  top: 6.4rem;
  left: 50%;
  opacity: 0;
  animation: finger 6s ease-in-out infinite;
}

/* The page goes up a little under the finger, then comes back. */
@keyframes page {
  0%,
  15% {
    transform: none;
  }
  44% {
    transform: translateY(-1.4rem);
  }
  52%,
  100% {
    transform: none;
  }
}

@keyframes rest {
  0%,
  16% {
    opacity: 1;
  }
  24%,
  92% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@keyframes grow {
  0%,
  16% {
    opacity: 0;
    transform: translateY(1rem) scale(0.6);
  }
  28%,
  90% {
    opacity: 1;
    transform: none;
  }
  98%,
  100% {
    opacity: 0;
    transform: none;
  }
}

@keyframes fill {
  0%,
  18% {
    stroke-dashoffset: 120;
  }
  46%,
  100% {
    stroke-dashoffset: 0;
  }
}

@keyframes check {
  0%,
  48% {
    opacity: 0;
    transform: scale(0.4);
  }
  54%,
  100% {
    opacity: 1;
    transform: none;
  }
}

@keyframes release {
  0%,
  48% {
    opacity: 1;
  }
  52%,
  100% {
    opacity: 0;
  }
}

@keyframes said {
  0%,
  50% {
    opacity: 0;
  }
  56%,
  100% {
    opacity: 1;
  }
}

/* The finger pushes up from the bottom, then lets go. */
@keyframes finger {
  0%,
  10% {
    opacity: 0;
    transform: none;
  }
  15% {
    opacity: 1;
    transform: none;
  }
  46% {
    opacity: 1;
    transform: translateY(-2.4rem);
  }
  52%,
  100% {
    opacity: 0;
    transform: translateY(-2.4rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .page,
  .rest,
  .grow,
  .dial-fill,
  .dial-check,
  .title,
  .sub,
  .finger {
    animation: none;
  }
  /* Pushed to the full: the ring filled, « Relâchez ». */
  .rest {
    opacity: 0;
  }
  .grow {
    opacity: 1;
  }
  .dial-fill {
    stroke-dashoffset: 0;
  }
  .finger {
    opacity: 1;
    transform: translateY(-2.4rem);
  }
}
</style>
