<script setup lang="ts">
defineProps<{
  userDisplayName: string;
}>();
</script>

<template>
  <div class="bg-gradient-to-br from-primary to-secondary py-14 px-6 md:px-12 mb-12">
    <div class="max-w-[1200px] mx-auto">
      <h1 class="text-3xl md:text-4xl font-bold text-white tracking-tight">
        {{ userDisplayName }}
      </h1>
    </div>
  </div>
</template>
