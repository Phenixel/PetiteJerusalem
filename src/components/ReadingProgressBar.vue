<script setup lang="ts">
import { computed } from "vue";
import { isNativeApp } from "../composables/useNativeApp";
import { useScrollFrame } from "../composables/useScrollFrame";

/**
 * La progression de lecture : un filet au bas de l'écran qui se remplit à
 * mesure qu'on descend, le même sur tous les textes de la bibliothèque. Un
 * office, une paracha, un chapitre de guemara sont longs et se lisent d'un
 * trait ; la barre dit où l'on en est sans rien réclamer.
 */
// La mesure vient de l'image partagée (useScrollFrame) : un seul écouteur et
// une seule lecture de la hauteur du document pour toute l'app.
const scrollFrame = useScrollFrame();
const progress = computed(() => scrollFrame.value.progress);

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
    <!-- scaleX plutôt que width : le remplissage suit chaque frame de
         défilement, une largeur animée relancerait mise en page et peinture
         à chacune ; la transformation reste sur le compositeur. -->
    <div
      class="h-full w-full origin-left bg-primary/80 rtl:origin-right"
      :style="{ transform: `scaleX(${progress})` }"
    ></div>
  </div>
</template>
