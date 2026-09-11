<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import AppIcon from "./icons/AppIcon.vue";
import { liveValue } from "../composables/liveInput";
import { speechMayBeAvailable } from "../services/speechRecognition";

/**
 * L'entrée de la recherche unique, posée sur l'accueil : un champ où l'on
 * tape ce qu'on cherche (« Entrée » ouvre les résultats) et un micro qui
 * ouvre la page de recherche en dictée. La page fait le reste : ce composant
 * vit dans le premier chargement du site et n'embarque ni moteur de
 * recherche ni dictée, il ne fait que naviguer.
 *
 * Le micro ne paraît que là où la dictée a une chance d'exister (l'app, ou un
 * navigateur qui a l'API Web Speech) : un bouton qui ne peut qu'échouer n'a
 * rien à faire sur l'accueil.
 */
const router = useRouter();
const { t } = useI18n();
const term = ref("");
const voice = speechMayBeAvailable();

function submit() {
  const q = term.value.trim();
  void router.push(q ? { path: "/recherche", query: { q } } : "/recherche");
}

function dictate() {
  void router.push({ path: "/recherche", query: { voice: "1" } });
}
</script>

<template>
  <form role="search" class="relative w-full max-w-xl mx-auto" @submit.prevent="submit">
    <AppIcon
      name="search"
      :size="16"
      class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary/70 pointer-events-none"
    />
    <input
      :value="term"
      @input="term = liveValue($event)"
      type="search"
      enterkeyhint="search"
      :placeholder="t('search.launcherPlaceholder')"
      :aria-label="t('search.title')"
      class="field !pl-11"
      :class="voice ? '!pr-12' : ''"
    />
    <button
      v-if="voice"
      type="button"
      class="icon-btn !w-8 !h-8 absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary/70 hover:text-primary"
      :aria-label="t('search.voice.start')"
      :title="t('search.voice.start')"
      @click="dictate"
    >
      <AppIcon name="mic" :size="16" />
    </button>
  </form>
</template>
