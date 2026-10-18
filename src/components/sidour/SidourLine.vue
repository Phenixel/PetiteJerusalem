<script setup lang="ts">
/**
 * A line under the Sidour's card of the moment: the service under an
 * occasion, havdala, the moon on its nights. Like every highlighted line, it
 * carries its object in the corner (CardArt), never an icon on the left.
 *
 * When what it announces can be said now, it is swiped right to say it is
 * done, as the card above it and the home stack (the « C'est fait » pill
 * coming out from under its left edge): the page then takes it away.
 */
import { computed } from "vue";
import type { RouteLocationRaw } from "vue-router";
import CardArt, { type CardArtSpec } from "../CardArt.vue";
import { dragStyle, useSwipe } from "../../composables/useSwipe";
import DoneCue from "./DoneCue.vue";

const props = defineProps<{
  to: RouteLocationRaw;
  name: string;
  meta: string;
  art: CardArtSpec;
  /** The object's scale: the moon a little larger than the book. */
  artScale?: number;
  /** It can be said now: the line is swiped to say it is done. */
  swipeable?: boolean;
}>();

const emit = defineEmits<{ (e: "done"): void; (e: "open"): void }>();

const SWIPE_THRESHOLD = 110;

const swipe = useSwipe({
  x: true,
  threshold: SWIPE_THRESHOLD,
  onSwipe: (direction) => {
    if (direction === "right" && props.swipeable) emit("done");
  },
});
const style = computed(() => (props.swipeable ? dragStyle(swipe, { right: true }) : {}));
const cue = computed(() => {
  if (!props.swipeable || !swipe.dragging.value || swipe.axis.value !== "x") return null;
  if (swipe.dx.value <= 0) return null;
  const strength = Math.min(1, swipe.dx.value / SWIPE_THRESHOLD);
  return { strength, armed: strength >= 1 };
});
</script>

<template>
  <div class="line-lane">
    <RouterLink
      :to="to"
      draggable="false"
      class="card card-hover press-feedback group relative flex min-h-16 items-center px-4 py-3.5 pe-24"
      :class="{ 'line-swipe': swipeable }"
      :style="style"
      v-bind="swipeable ? swipe.listeners : {}"
      @click="emit('open')"
    >
      <CardArt :art="art" :scale="artScale ?? 0.42" surface="plain" />
      <span class="relative flex flex-col gap-0.5 min-w-0">
        <span class="font-semibold text-text-primary group-hover:text-primary transition-colors">
          {{ name }}
        </span>
        <span class="text-sm text-text-secondary">{{ meta }}</span>
      </span>
      <DoneCue v-if="cue" :strength="cue.strength" :armed="cue.armed" />
    </RouterLink>
  </div>
</template>

<style scoped>
/* Swiped right, the line does not make the page scroll sideways; its object
   still comes out through the top. */
.line-lane {
  overflow-x: clip;
}
.line-swipe {
  touch-action: pan-y;
  transition: transform 0.25s ease;
}
@media (prefers-reduced-motion: reduce) {
  .line-swipe {
    transition: none;
  }
}
</style>
