<script setup lang="ts">
// La matsa de Pessah : la galette ronde, piquée de trous, à la seconde
// couleur. À l'arrivée, elle se pose.
import OrnamentPose from "./OrnamentPose.vue";
</script>

<template>
  <OrnamentPose>
    <circle cx="32" cy="32" r="22" />
    <path class="accent" d="M26 20h.01" />
    <path class="accent" d="M38 20h.01" />
    <path class="accent" d="M20 28h.01" />
    <path class="accent" d="M32 28h.01" />
    <path class="accent" d="M44 28h.01" />
    <path class="accent" d="M20 36h.01" />
    <path class="accent" d="M32 36h.01" />
    <path class="accent" d="M44 36h.01" />
    <path class="accent" d="M26 44h.01" />
    <path class="accent" d="M38 44h.01" />
  </OrnamentPose>
</template>
