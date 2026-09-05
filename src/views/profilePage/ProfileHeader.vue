<script setup lang="ts">
defineProps<{
  userDisplayName: string;
}>();
</script>

<template>
  <!-- Le nom, seul, en tête de page : l'aplat de couleur qui le portait ne
       disait rien de plus que lui. -->
  <div class="py-10 px-6 md:px-12 mb-10 border-b border-line">
    <div class="max-w-[1200px] mx-auto">
      <h1 class="text-3xl md:text-4xl text-text-primary">
        {{ userDisplayName }}
      </h1>
    </div>
  </div>
</template>
