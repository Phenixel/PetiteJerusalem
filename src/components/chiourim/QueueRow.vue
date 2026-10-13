<script setup lang="ts">
/**
 * Une ligne de la file du lecteur plein écran (NowPlayingSheet) : la place
 * du cours dans sa série, son titre, et dessous son chapitre et sa durée. Un
 * appui le lance. Les cours d'avant et ceux qui suivent se lisent pareil.
 */
defineProps<{ number: number | string; title: string; line?: string }>();
defineEmits<{ click: [] }>();
</script>

<template>
  <button
    type="button"
    class="flex w-full items-start gap-4 px-5 py-3.5 text-start transition-colors hover:bg-white/5"
    @click="$emit('click')"
  >
    <span class="w-7 shrink-0 pt-0.5 text-sm tabular-nums opacity-55">{{ number }}</span>
    <span class="min-w-0 flex-1">
      <span dir="auto" class="font-medium leading-snug line-clamp-2">{{ title }}</span>
      <span v-if="line" class="mt-0.5 block text-sm opacity-60">{{ line }}</span>
    </span>
  </button>
</template>
