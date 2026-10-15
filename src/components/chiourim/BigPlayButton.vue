<script setup lang="ts">
/**
 * Le grand bouton rond d'une série, d'un cours ou d'un rav, au bout de la
 * ligne des actions, comme sur une playlist : il lance (ou reprend) l'écoute,
 * et met en pause quand c'est ce qu'on écoute qui joue. Son nom reste dit aux
 * lecteurs d'écran (« Reprendre l'épisode 4 »).
 */
import AppIcon from "../icons/AppIcon.vue";

defineProps<{ playing: boolean; label: string }>();
defineEmits<{ click: [] }>();
</script>

<template>
  <button
    type="button"
    class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand shadow-card transition-transform hover:scale-105 active:scale-95"
    :aria-label="label"
    :title="label"
    @click="$emit('click')"
  >
    <AppIcon :name="playing ? 'pause-solid' : 'play-solid'" :size="24" />
  </button>
</template>
