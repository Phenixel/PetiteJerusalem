<script setup lang="ts">
defineProps<{
  userDisplayName: string;
}>();
</script>

<template>
  <!-- Le nom, en grand, surligné au soleil. -->
  <div class="py-10 px-6 md:px-12 mb-8">
    <div class="max-w-[1200px] mx-auto">
      <h1 class="text-4xl md:text-5xl text-text-primary">
        <span class="hl">{{ userDisplayName }}</span>
      </h1>
    </div>
  </div>
</template>
