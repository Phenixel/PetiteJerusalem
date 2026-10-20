<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import AppModal from "./AppModal.vue";
import { KLAF_PHOTOS } from "../content/klaf";
import { closeKlaf, klafOpen, KLAF_LABELS } from "../composables/useKlaf";
import { usePinchZoom } from "../composables/usePinchZoom";

/**
 * The parchment, opened from the paragraph of the sidour that carries it:
 * its photo alone, edge to edge, in a window that takes the photo's shape.
 * No title, no tabs, no caption: the photo is what you came to see, and the
 * vocalized text is already in the flow of the service.
 *
 * It reads up close the way a photo does: two fingers pinch it open, one
 * finger moves through it, a double tap enlarges where it lands (see
 * usePinchZoom). The pitoum haketoret has two pages: a swipe or the arrows
 * at the bottom turn them. The cross closes it, like a touch on the veil.
 */
const { t } = useI18n();

const kind = computed(() => klafOpen.value);
const photos = computed(() => (kind.value ? KLAF_PHOTOS[kind.value] : []));
const title = computed(() => (kind.value ? t(KLAF_LABELS[kind.value].title) : ""));

const page = ref(0);
const photo = computed(() => photos.value[page.value] ?? null);

const stage = ref<HTMLElement | null>(null);
const { view, gesturing, reset, handlers } = usePinchZoom(stage, (direction) => {
  // The finger pushes the page away: toward the line start for the next
  // one, which is the left in French and the right in Hebrew.
  const rtl = stage.value ? getComputedStyle(stage.value).direction === "rtl" : false;
  turn(direction === (rtl ? 1 : -1) ? 1 : -1);
});

function turn(step: number): void {
  const next = page.value + step;
  if (next < 0 || next >= photos.value.length) return;
  page.value = next;
  reset();
}

// Each opening starts from the first page, unzoomed: what was enlarged last
// time says nothing about what you are looking for today.
watch(klafOpen, (open) => {
  if (open) {
    page.value = 0;
    reset();
  }
});

const transform = computed(
  () => `translate(${view.value.x}px, ${view.value.y}px) scale(${view.value.scale})`,
);
</script>

<template>
  <AppModal
    :open="kind !== null"
    :label="title"
    overlay-class="modal-overlay klaf-overlay"
    panel-class="klaf-panel animate-[scaleIn_0.3s_ease]"
    @close="closeKlaf"
  >
    <div
      v-if="photo"
      ref="stage"
      class="klaf-stage"
      :style="{ '--klaf-ratio': `${photo.width} / ${photo.height}` }"
      v-on="handlers"
    >
      <img
        :key="photo.src"
        :src="photo.src"
        :width="photo.width"
        :height="photo.height"
        :alt="t('textReading.klaf.photoAlt', { title, n: page + 1 })"
        class="klaf-photo"
        :class="{ 'klaf-following': gesturing }"
        :style="{ transform }"
        decoding="async"
        draggable="false"
      />
    </div>

    <button
      type="button"
      class="klaf-control klaf-close"
      :aria-label="t('common.close')"
      @click="closeKlaf"
    >
      <AppIcon name="x" :size="18" />
    </button>

    <div v-if="photos.length > 1" class="klaf-control klaf-pages">
      <button
        type="button"
        class="klaf-turn"
        :disabled="page === 0"
        :aria-label="t('textReading.klaf.previous')"
        @click="turn(-1)"
      >
        <AppIcon name="chevron-left" :size="18" class="rtl:-scale-x-100" />
      </button>
      <span class="klaf-count" aria-live="polite">{{ page + 1 }} / {{ photos.length }}</span>
      <button
        type="button"
        class="klaf-turn"
        :disabled="page === photos.length - 1"
        :aria-label="t('textReading.klaf.next')"
        @click="turn(1)"
      >
        <AppIcon name="chevron-right" :size="18" class="rtl:-scale-x-100" />
      </button>
    </div>
  </AppModal>
</template>

<!-- The veil and the frame are AppModal's elements, out of reach of scoped
     styles: their rules are global, under names that belong only to the
     parchment. -->
<style>
/* A darker veil than the other windows: a photo is looked at against the
   dark, and the window is centered rather than set at the top. */
.klaf-overlay {
  align-items: center;
  background-color: rgb(20 16 8 / 0.75);
}

/* The frame holds the photo and nothing else: its size is the stage's (see
   below). The black stands in while the photo loads. */
.klaf-panel {
  position: relative;
  margin-block: auto;
  overflow: hidden;
  background: #000;
  border-radius: var(--radius-xl);
  box-shadow: 0 24px 60px rgb(0 0 0 / 0.45);
}
</style>

<style scoped>
/* The stage takes the photo's shape and the largest size the screen allows,
   its width or its height, whichever runs out first. The photo covers it
   entirely: no white around it. */
.klaf-stage {
  position: relative;
  width: min(
    calc(100vw - 2rem),
    calc((var(--modal-viewport-height, 100dvh) - 2rem) * var(--klaf-ratio)),
    56rem
  );
  aspect-ratio: var(--klaf-ratio);
  overflow: hidden;
  /* The fingers belong to the photo: the browser neither zooms nor scrolls
     the page under them. */
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: grab;
}

.klaf-stage:active {
  cursor: grabbing;
}

.klaf-photo {
  display: block;
  width: 100%;
  height: 100%;
  max-width: none;
  object-fit: cover;
  transform-origin: 0 0;
  transition: transform 0.25s ease;
  -webkit-user-drag: none;
  pointer-events: none;
}

/* Under the finger, the photo follows without delay. */
.klaf-following {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .klaf-photo {
    transition: none;
  }
}

/* The commands laid on the photo: round, on a dark disk that keeps them
   readable on the light parchment as on its dark edge. */
.klaf-control {
  position: absolute;
  color: #fff;
  background-color: rgb(0 0 0 / 0.5);
  border-radius: var(--radius-pill);
}

.klaf-close {
  top: 0.625rem;
  inset-inline-end: 0.625rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  transition: background-color 0.15s ease;
}

.klaf-close:hover {
  background-color: rgb(0 0 0 / 0.7);
}

.klaf-pages {
  bottom: 0.625rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem;
}

.klaf-turn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-pill);
}

.klaf-turn:disabled {
  opacity: 0.35;
}

.klaf-count {
  min-width: 2.5rem;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
