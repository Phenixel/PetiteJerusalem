<script setup lang="ts">
/**
 * Les passages qui encadrent une lecture (voir encadrementService) : le Yehi
 * ratson des Tehilim, le Léchem yihoud du Cantique des cantiques.
 *
 * Toujours repliés à l'ouverture : ils accompagnent la lecture, ils ne sont
 * pas ce qu'on vient lire, et déplier deux prières longues au-dessus du
 * premier psaume repousserait le texte hors de l'écran. Un appui sur le titre
 * les ouvre, et ils restent ouverts le temps de la page.
 */
import { computed, ref } from "vue";
import type { TextBlock } from "../services/textService";
import { transliterate } from "../services/hebrewTransliteration";
import { useReadingSize } from "../composables/useReadingSize";
import LiturgyText from "../views/TextReading/LiturgyText.vue";
import CollapseTransition from "./CollapseTransition.vue";
import AppIcon from "./icons/AppIcon.vue";

const props = defineProps<{
  blocks: TextBlock[];
  /** Titre de l'encadré : « Avant la lecture », « Après la lecture ». */
  title: string;
  /** Le lecteur lit en phonétique : ces passages la suivent. */
  showPhonetic?: boolean;
}>();

const open = ref(false);

// Le réglage A− / A+ du lecteur : ces passages se lisent à la taille du texte
// qu'ils encadrent, pas à une taille à eux.
const readingSize = useReadingSize();

// Aucune occasion ni marque-page ici : ces passages se disent tels quels, et
// c'est le texte qu'ils encadrent qui porte les marque-pages du lecteur.
const noOccasions = new Set<string>();
const notBookmarked = () => false;

/**
 * La translittération n'est calculée que si le lecteur l'a demandée : elle
 * parcourt chaque lettre, et ces passages sont longs.
 */
const phoneticLines = computed(() =>
  props.showPhonetic ? props.blocks.flatMap((block) => block.lines).map(transliterate) : [],
);
</script>

<template>
  <section class="my-6 rounded-xl bg-black/[0.04] overflow-hidden dark:bg-white/[0.05]">
    <button
      type="button"
      class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="text-sm font-semibold text-text-secondary">{{ title }}</span>
      <AppIcon
        :name="open ? 'chevron-up' : 'chevron-down'"
        :size="16"
        class="flex-shrink-0 text-text-secondary"
      />
    </button>

    <CollapseTransition>
      <div v-show="open" class="px-4 pb-4">
        <LiturgyText
          :style="{ '--reading-scale': readingSize.scale.value }"
          :blocks="blocks"
          :show-phonetic="!!showPhonetic"
          :phonetic-lines="phoneticLines"
          :occasions="noOccasions"
          :recent-changes="noOccasions"
          :highlighted-line="null"
          :selected-line="null"
          :is-bookmarked="notBookmarked"
          :anchored="false"
        />
      </div>
    </CollapseTransition>
  </section>
</template>
