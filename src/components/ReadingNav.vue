<script setup lang="ts">
// Prev / middle / next navigation bar used in the reading page (top and bottom).
// A label set to null/undefined hides its button (e.g. at the first/last item).
import AppIcon from "./icons/AppIcon.vue";

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
      class="btn btn-soft !px-4 !py-2 text-sm max-w-[45%]"
    >
      <AppIcon name="chevron-left" :size="14" class="flex-shrink-0" />
      <span class="truncate">{{ prevLabel }}</span>
    </button>
    <span v-else></span>

    <button
      v-if="middleLabel"
      @click="$emit('middle')"
      class="text-sm text-text-secondary hover:text-primary transition-colors"
    >
      {{ middleLabel }}
    </button>

    <button
      v-if="nextLabel"
      @click="$emit('next')"
      class="btn btn-soft !px-4 !py-2 text-sm max-w-[45%]"
    >
      <span class="truncate">{{ nextLabel }}</span>
      <AppIcon name="chevron-right" :size="14" class="flex-shrink-0" />
    </button>
    <span v-else></span>
  </nav>
</template>
