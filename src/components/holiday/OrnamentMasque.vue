<script setup lang="ts">
// Le masque de Pourim : un loup, ses deux yeux, et les plumes qui le
// coiffent, à la seconde couleur. À l'arrivée, il se pose.
import OrnamentPose from "./OrnamentPose.vue";
</script>

<template>
  <OrnamentPose>
    <path
      d="M6 28c8-8 18-9 26-3 8-6 18-5 26 3-2 12-8 20-18 20-4 0-6-3-8-5-2 2-4 5-8 5-10 0-16-8-18-20z"
    />
    <path d="M15 32c2-4 8-4 10 0-2 4-8 4-10 0z" />
    <path d="M39 32c2-4 8-4 10 0-2 4-8 4-10 0z" />
    <path class="accent" d="m32 25-6-18" />
    <path class="accent" d="m32 25 1-20" />
    <path class="accent" d="m32 25 8-16" />
  </OrnamentPose>
</template>
