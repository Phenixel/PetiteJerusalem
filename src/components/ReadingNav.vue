<script setup lang="ts">
// Prev / middle / next navigation bar used in the reading page (top and bottom).
// A label set to null/undefined hides its button (e.g. at the first/last item).
defineProps<{
  prevLabel?: string | null;
  nextLabel?: string | null;
  middleLabel?: string | null;
}>();
defineEmits<{ prev: []; next: []; middle: [] }>();
</script>

<template>
  <nav class="flex items-center justify-between gap-3">
    <button
      v-if="prevLabel"
      @click="$emit('prev')"
      class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 hover:border-primary hover:text-primary transition-all max-w-[45%] dark:border-gray-700"
    >
      <i class="fa-solid fa-chevron-left text-xs flex-shrink-0"></i>
      <span class="truncate">{{ prevLabel }}</span>
    </button>
    <span v-else></span>

    <button
      v-if="middleLabel"
      @click="$emit('middle')"
      class="text-sm text-text-secondary hover:text-primary transition-colors dark:text-gray-400"
    >
      {{ middleLabel }}
    </button>

    <button
      v-if="nextLabel"
      @click="$emit('next')"
      class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 hover:border-primary hover:text-primary transition-all max-w-[45%] dark:border-gray-700"
    >
      <span class="truncate">{{ nextLabel }}</span>
      <i class="fa-solid fa-chevron-right text-xs flex-shrink-0"></i>
    </button>
    <span v-else></span>
  </nav>
</template>
