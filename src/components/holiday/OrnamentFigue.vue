<script setup lang="ts">
// La figue de Tou Bichvat : le fruit en goutte, sa queue, et ses nervures,
// à la seconde couleur. À l'arrivée, elle se pose.
import OrnamentPose from "./OrnamentPose.vue";
</script>

<template>
  <OrnamentPose>
    <path d="M32 12c-3 6-11 9-13 19-2 11 5 21 13 21s15-10 13-21c-2-10-10-13-13-19z" />
    <path d="M32 12c0-4 1-7 3-9" />
    <path class="accent" d="M32 24v22" />
    <path class="accent" d="M24 34c3 3 5 6 8 12" />
    <path class="accent" d="M40 34c-3 3-5 6-8 12" />
  </OrnamentPose>
</template>
