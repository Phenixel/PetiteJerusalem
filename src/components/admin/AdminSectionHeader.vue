<script setup lang="ts">
/**
 * L'en-tête d'une section du backoffice : son titre, une ligne qui dit où
 * l'on en est (« 142 chiourim, 3 à relire »), et à droite l'action principale.
 */
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div class="min-w-0">
      <h2 class="font-display text-2xl md:text-3xl font-bold tracking-tight text-text-primary">
        {{ title }}
      </h2>
      <p v-if="description" class="mt-1 text-text-secondary">{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="flex flex-wrap items-center gap-2">
      <slot />
    </div>
  </div>
</template>
