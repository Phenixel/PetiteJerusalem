<script setup lang="ts">
// La crécelle de Pourim : le manche, la boîte qui tourne, la manivelle, et
// le bruit qu'elle fait, à la seconde couleur. À l'arrivée, elle se pose.
import OrnamentPose from "./OrnamentPose.vue";
</script>

<template>
  <OrnamentPose>
    <path d="M22 60V40" />
    <path d="M18 40h24V22H18z" />
    <path d="M24 28h12" />
    <path d="M24 34h12" />
    <path d="M42 31h10" />
    <path d="M52 22v18" />
    <path class="accent" d="m58 16 3-3" />
    <path class="accent" d="M60 31h4" />
    <path class="accent" d="m58 46 3 3" />
  </OrnamentPose>
</template>
