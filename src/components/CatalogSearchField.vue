<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import { isNativeApp } from "../composables/useNativeApp";
import { liveValue } from "../composables/liveInput";

/**
 * Le champ de recherche, le même dans la bibliothèque, dans la composition
 * de la lecture du jour et sur la page de recherche : loupe, saisie qui suit
 * la frappe (voir liveInput), croix d'effacement. Collant dans l'app, pour
 * rester à portée pendant le défilement.
 *
 * Le modèle se nomme `term` (`v-model:term`) : c'est le champ lui-même qui
 * lit l'événement de saisie, jamais un `v-model` posé sur l'input.
 *
 * `voice` ajoute le micro, à droite : le champ ne fait qu'en annoncer l'appui
 * (`@voice`), la dictée elle-même appartient à la page (useSpeechInput), qui
 * dit par `listening` si le micro est ouvert. Le micro ouvert prend la couleur
 * du thème et bat doucement : on sait qu'on est écouté.
 */
defineProps<{
  placeholder: string;
  /** Proposer la dictée. */
  voice?: boolean;
  /** Le micro est ouvert. */
  listening?: boolean;
  /** Le champ prend le clavier à l'arrivée. */
  autofocus?: boolean;
  /** Plus large que le champ de la bibliothèque : la page de recherche n'a que lui. */
  wide?: boolean;
}>();

const emit = defineEmits<{ voice: [] }>();

const term = defineModel<string>("term", { required: true });
const { t } = useI18n();
</script>

<template>
  <div :class="isNativeApp ? 'app-sticky-search' : ''" class="flex justify-center">
    <div class="relative w-full" :class="wide ? 'md:max-w-xl' : 'md:w-96'">
      <AppIcon
        name="search"
        :size="16"
        class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/70 pointer-events-none"
      />
      <input
        :value="term"
        @input="term = liveValue($event)"
        type="text"
        :placeholder="placeholder"
        :autofocus="autofocus"
        enterkeyhint="search"
        class="field !pl-11"
        :class="voice ? '!pr-20' : ''"
      />
      <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        <button
          v-if="term"
          type="button"
          @click="term = ''"
          class="icon-btn !w-8 !h-8 text-text-secondary/70 hover:text-text-primary"
          :aria-label="t('search.clear')"
        >
          <AppIcon name="x" :size="14" />
        </button>
        <button
          v-if="voice"
          type="button"
          class="icon-btn !w-8 !h-8"
          :class="listening ? 'text-primary voice-live' : 'text-text-secondary/70 hover:text-primary'"
          :aria-pressed="listening ? 'true' : 'false'"
          :aria-label="listening ? t('search.voice.stop') : t('search.voice.start')"
          :title="listening ? t('search.voice.stop') : t('search.voice.start')"
          @click="emit('voice')"
        >
          <AppIcon name="mic" :size="16" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Le micro ouvert bat au rythme d'une respiration : ni clignotement ni
   changement de forme, juste la couleur qui monte et descend. */
.voice-live {
  animation: voice-live 1.4s ease-in-out infinite;
}
@keyframes voice-live {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}
@media (prefers-reduced-motion: reduce) {
  .voice-live {
    animation: none;
  }
}
</style>
