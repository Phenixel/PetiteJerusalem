<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { isNativeApp } from "../composables/useNativeApp";

/**
 * La progression de lecture : un filet au bas de l'écran qui se remplit à
 * mesure qu'on descend, le même sur tous les textes de la bibliothèque. Un
 * office, une paracha, un chapitre de guemara sont longs et se lisent d'un
 * trait ; la barre dit où l'on en est sans rien réclamer.
 */
const progress = ref(0);
let raf = 0;

const update = () => {
  raf = 0;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.value = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
};

const onScroll = () => {
  if (!raf) raf = requestAnimationFrame(update);
};

onMounted(() => {
  update();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener("scroll", onScroll);
  window.removeEventListener("resize", onScroll);
  if (raf) cancelAnimationFrame(raf);
});

// App native : la barre se pose au-dessus de la bottom bar (h-14 + safe-area),
// pas collée au bord de l'écran où la barre de gestes la recouvrirait.
const bottomClass = isNativeApp ? "bottom-[calc(3.5rem+var(--safe-bottom))]" : "bottom-0";
</script>

<template>
  <div
    class="fixed inset-x-0 z-40 h-1 pointer-events-none bg-black/5 dark:bg-white/10"
    :class="bottomClass"
    role="progressbar"
    :aria-valuenow="Math.round(progress * 100)"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div
      class="h-full bg-primary/80 transition-[width] duration-150 ease-linear"
      :style="{ width: `${progress * 100}%` }"
    ></div>
  </div>
</template>
