<script setup lang="ts">
// Timeline animée « Comment ça marche » du partage de lectures : jouée une
// seule fois quand elle entre dans le viewport. Extraite de ShareHomePage pour
// pouvoir la placer en tête pour les visiteurs et en bas de page pour les
// connectés (qui connaissent déjà le principe).
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";

const { t } = useI18n();

const timelineRef = ref<HTMLElement | null>(null);
const timelineInView = ref(false);
let timelineObserver: IntersectionObserver | null = null;

const howItWorksSteps = computed(() => [
  {
    icon: "circle-plus" as const,
    title: t("shareReading.howItWorks.step1Title"),
    description: t("shareReading.howItWorks.step1Desc"),
  },
  {
    icon: "book-open" as const,
    title: t("shareReading.howItWorks.step2Title"),
    description: t("shareReading.howItWorks.step2Desc"),
  },
  {
    icon: "share" as const,
    title: t("shareReading.howItWorks.step3Title"),
    description: t("shareReading.howItWorks.step3Desc"),
  },
  {
    icon: "flag" as const,
    title: t("shareReading.howItWorks.step4Title"),
    description: t("shareReading.howItWorks.step4Desc"),
  },
]);

// Play the timeline animation once: immediately if it's already on screen at
// load, otherwise the first time it scrolls into view. Falls back to simply
// showing it if observers are unavailable.
function setupTimelineReveal() {
  const el = timelineRef.value;
  const activate = () => {
    timelineInView.value = true;
    timelineObserver?.disconnect();
    timelineObserver = null;
  };

  if (!el || typeof IntersectionObserver === "undefined") {
    activate();
    return;
  }

  // Already on screen at load: activate now (the CSS animation plays as the
  // class is applied). Otherwise wait for it to scroll into view.
  const rect = el.getBoundingClientRect();
  if (rect.top < window.innerHeight && rect.bottom > 0) {
    activate();
    return;
  }

  timelineObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) activate();
    },
    { threshold: 0.2 },
  );
  timelineObserver.observe(el);
}

onMounted(() => {
  setupTimelineReveal();
});

onUnmounted(() => {
  timelineObserver?.disconnect();
});
</script>

<template>
  <section class="max-w-5xl mx-auto">
    <div class="text-center mb-10">
      <h3 class="text-2xl md:text-3xl font-bold text-text-primary">
        {{ t("shareReading.howItWorks.title") }}
      </h3>
      <p class="text-text-secondary max-w-2xl mx-auto mt-2">
        {{ t("shareReading.howItWorks.subtitle") }}
      </p>
    </div>

    <ol ref="timelineRef" class="timeline" :class="{ 'is-active': timelineInView }">
      <li
        v-for="(step, index) in howItWorksSteps"
        :key="step.title"
        class="timeline__step"
        :style="{ '--i': index }"
      >
        <span class="timeline__connector bg-black/[0.08] dark:bg-white/[0.12]" aria-hidden="true">
          <span class="timeline__fill"></span>
          <span class="timeline__runner"></span>
        </span>
        <span class="timeline__node">
          <AppIcon :name="step.icon" :size="20" />
        </span>
        <div class="timeline__content">
          <h4 class="timeline__title text-text-primary">{{ step.title }}</h4>
          <p class="timeline__desc text-text-secondary">
            {{ step.description }}
          </p>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
/* Animated "how it works" timeline.
   Mobile = vertical, desktop (>=768px) = horizontal. The connecting line fills
   step by step and a dot travels along it as each node lights up;
   the whole sequence plays once when the timeline scrolls into view. */
.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.timeline__step {
  position: relative;
  display: grid;
  grid-template-columns: 3rem 1fr;
  column-gap: 1.25rem;
  padding-bottom: 2.5rem;
}
.timeline__step:last-child {
  padding-bottom: 0;
}

/* --- node --- */
.timeline__node {
  position: relative;
  z-index: 2;
  grid-column: 1;
  width: 3rem;
  height: 3rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: var(--color-primary);
  /* idle state before activation */
  filter: grayscale(1);
  opacity: 0.4;
  transform: scale(0.88);
}
/* --- text --- */
.timeline__content {
  grid-column: 2;
  align-self: center;
}
/* Title/description colors are set via Tailwind utilities in the template
   (text-text-*) so dark mode adapts via the flipped CSS variables. */
.timeline__title {
  font-weight: 700;
  font-size: 1.05rem;
  margin-bottom: 0.2rem;
}
.timeline__desc {
  font-size: 0.875rem;
  line-height: 1.55;
}

/* --- connector (mobile: vertical) --- */
.timeline__connector {
  position: absolute;
  z-index: 1;
  inset-inline-start: 1.5rem;
  top: 3rem;
  width: 3px;
  height: calc(100% - 3rem);
  transform: translateX(-50%);
  border-radius: 9999px;
  /* track color set via Tailwind (bg-black/[0.08] dark:bg-white/[0.12]) */
}
.timeline__step:last-child .timeline__connector {
  display: none;
}
.timeline__fill {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--color-primary);
  transform: scaleY(0);
  transform-origin: top center;
}
.timeline__runner {
  position: absolute;
  inset-inline-start: 50%;
  top: 0;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 9999px;
  transform: translate(-50%, -50%);
  background: var(--color-secondary);
  opacity: 0;
}

/* --- activation (plays once when .is-active is added) --- */
.timeline.is-active .timeline__node {
  animation: tl-node 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  animation-delay: calc(var(--i) * 0.5s);
}
.timeline.is-active .timeline__fill {
  animation: tl-fill-y 0.5s ease forwards;
  animation-delay: calc(var(--i) * 0.5s + 0.25s);
}
.timeline.is-active .timeline__runner {
  animation: tl-run-y 0.55s ease forwards;
  animation-delay: calc(var(--i) * 0.5s + 0.25s);
}

@keyframes tl-node {
  0% {
    filter: grayscale(1);
    opacity: 0.4;
    transform: scale(0.85);
  }
  60% {
    transform: scale(1.12);
  }
  100% {
    filter: grayscale(0);
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes tl-fill-y {
  to {
    transform: scaleY(1);
  }
}
@keyframes tl-run-y {
  0% {
    top: 0;
    opacity: 1;
  }
  85% {
    opacity: 1;
  }
  100% {
    top: 100%;
    opacity: 0;
  }
}
@keyframes tl-fill-x {
  to {
    transform: scaleX(1);
  }
}
@keyframes tl-run-x {
  0% {
    inset-inline-start: 0;
    opacity: 1;
  }
  85% {
    opacity: 1;
  }
  100% {
    inset-inline-start: 100%;
    opacity: 0;
  }
}

/* --- desktop: horizontal --- */
@media (min-width: 768px) {
  .timeline {
    flex-direction: row;
    align-items: flex-start;
  }
  .timeline__step {
    flex: 1;
    grid-template-columns: none;
    grid-template-rows: 3.5rem auto;
    row-gap: 1.1rem;
    justify-items: center;
    text-align: center;
    padding-bottom: 0;
    padding-inline: 0.5rem;
  }
  .timeline__node {
    grid-column: auto;
    grid-row: 1;
    width: 3.5rem;
    height: 3.5rem;
  }
  .timeline__content {
    grid-column: auto;
    grid-row: 2;
  }
  .timeline__connector {
    top: 1.75rem;
    inset-inline-start: 50%;
    width: 100%;
    height: 3px;
    transform: translateY(-50%);
  }
  .timeline__fill {
    transform: scaleX(0);
    transform-origin: left center;
  }
  .timeline__runner {
    inset-inline-start: 0;
    top: 50%;
    transform: translate(-50%, -50%);
  }
  .timeline.is-active .timeline__fill {
    animation-name: tl-fill-x;
  }
  .timeline.is-active .timeline__runner {
    animation-name: tl-run-x;
  }
}

/* --- respect reduced-motion: show the final state, no movement --- */
@media (prefers-reduced-motion: reduce) {
  .timeline__node {
    filter: none;
    opacity: 1;
    transform: scale(1);
    animation: none;
  }
  .timeline__fill {
    transform: none;
    animation: none;
  }
  .timeline__runner {
    display: none;
  }
}
</style>
