<script setup lang="ts">
import AppIcon from "../icons/AppIcon.vue";
import type { IconName } from "../icons/registry";

/** Une liste vide, ou rien à traiter : un dessin, une phrase, une action éventuelle. */
defineProps<{ icon: IconName; message: string }>();
</script>

<template>
  <div class="card flex flex-col items-center gap-3 px-6 py-12 text-center">
    <span
      class="flex h-12 w-12 items-center justify-center rounded-pill bg-black/5 text-text-secondary dark:bg-white/10"
    >
      <AppIcon :name="icon" :size="22" />
    </span>
    <p class="max-w-sm text-text-secondary">{{ message }}</p>
    <slot />
  </div>
</template>
