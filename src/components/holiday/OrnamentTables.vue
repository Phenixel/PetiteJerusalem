<script setup lang="ts">
// Les tables de la loi de Chavouot : deux tables au sommet arrondi, côte à
// côte, et leurs lignes, à la seconde couleur. À l'arrivée, elles se posent.
import OrnamentPose from "./OrnamentPose.vue";
</script>

<template>
  <OrnamentPose>
    <path d="M10 58V24a11 11 0 0 1 22 0v34z" />
    <path d="M32 58V24a11 11 0 0 1 22 0v34" />
    <path class="accent" d="M16 32h10" />
    <path class="accent" d="M16 40h10" />
    <path class="accent" d="M16 48h10" />
    <path class="accent" d="M38 32h10" />
    <path class="accent" d="M38 40h10" />
    <path class="accent" d="M38 48h10" />
  </OrnamentPose>
</template>
