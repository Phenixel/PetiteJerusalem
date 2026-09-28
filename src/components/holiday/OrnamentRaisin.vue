<script setup lang="ts">
// La grappe de Tou Bichvat : six grains, la tige, et la feuille et la vrille
// à la seconde couleur. À l'arrivée, elle se pose.
import OrnamentPose from "./OrnamentPose.vue";
</script>

<template>
  <OrnamentPose>
    <circle cx="22" cy="30" r="5.5" />
    <circle cx="32" cy="30" r="5.5" />
    <circle cx="42" cy="30" r="5.5" />
    <circle cx="27" cy="39.5" r="5.5" />
    <circle cx="37" cy="39.5" r="5.5" />
    <circle cx="32" cy="49" r="5.5" />
    <path d="M32 24V12" />
    <path class="accent" d="M32 12c3-7 10-9 16-7-2 6-8 10-16 7z" />
    <path class="accent" d="M32 12c-3-2-5-5-4-8" />
  </OrnamentPose>
</template>
