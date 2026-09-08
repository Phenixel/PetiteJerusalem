<script setup lang="ts">
import AppIcon from "./icons/AppIcon.vue";
import { isNativeApp } from "../composables/useNativeApp";
import { liveValue } from "../composables/liveInput";

/**
 * Le champ de recherche du catalogue, le même dans la bibliothèque et dans
 * la composition de la lecture du jour : loupe, saisie qui suit la frappe
 * (voir liveInput), croix d'effacement. Collant dans l'app, pour rester à
 * portée pendant le défilement du catalogue.
 *
 * Le modèle se nomme `term` (`v-model:term`) : c'est le champ lui-même qui
 * lit l'événement de saisie, jamais un `v-model` posé sur l'input.
 */
defineProps<{
  placeholder: string;
}>();

const term = defineModel<string>("term", { required: true });
</script>

<template>
  <div :class="isNativeApp ? 'app-sticky-search' : ''" class="flex justify-center">
    <div class="relative w-full md:w-96">
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
        class="field !pl-11"
      />
      <button
        v-if="term"
        @click="term = ''"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary/70 hover:text-text-primary transition-colors"
      >
        <AppIcon name="x" :size="14" />
      </button>
    </div>
  </div>
</template>
