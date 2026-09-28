<script setup lang="ts">
// Le beignet de 'Hanouka : la boule, le sucre glace qui la coiffe, et la
// confiture qui perle au sommet, à la seconde couleur. À l'arrivée, il se
// pose.
import OrnamentPose from "./OrnamentPose.vue";
</script>

<template>
  <OrnamentPose>
    <circle cx="32" cy="36" r="22" />
    <path d="M12 32c6-5 12-8 20-8s14 3 20 8" />
    <path class="accent" d="M22 28h.01" />
    <path class="accent" d="M32 25h.01" />
    <path class="accent" d="M42 28h.01" />
    <path class="accent" d="M27 20c0-3 2-5 5-5s5 2 5 5-2 4-5 4-5-1-5-4z" />
  </OrnamentPose>
</template>
